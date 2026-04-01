#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CANONICAL_ROOT = REPO_ROOT / "skills"
LOCK_DIR = REPO_ROOT / ".sync.lock"
DEFAULT_AUTHOR_NAME = "txhno"
DEFAULT_AUTHOR_EMAIL = "198242577+txhno@users.noreply.github.com"
LOG_PREFIX = "[harness-skills]"


@dataclass(frozen=True)
class Target:
    name: str
    root: Path


TARGETS = [
    Target("claude", Path.home() / ".claude" / "skills"),
    Target("codex", Path.home() / ".codex" / "skills"),
    Target("droid", Path.home() / ".openclaw" / "skills"),
    Target("cursor", Path.home() / ".cursor" / "skills-cursor"),
]


class SyncError(RuntimeError):
    pass


def log(message: str) -> None:
    print(f"{LOG_PREFIX} {message}")


def run(
    args: list[str],
    *,
    cwd: Path | None = None,
    capture_output: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=capture_output,
        check=check,
    )


def read_bytes(path: Path) -> bytes:
    return path.read_bytes()


def write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def files_equal(path_a: Path, path_b: Path) -> bool:
    if not path_a.exists() or not path_b.exists():
        return False
    return read_bytes(path_a) == read_bytes(path_b)


def prefer_file(path_a: Path, path_b: Path) -> tuple[Path, str]:
    stat_a = path_a.stat()
    stat_b = path_b.stat()
    if int(stat_a.st_mtime) != int(stat_b.st_mtime):
        return (path_a, "newer mtime") if stat_a.st_mtime > stat_b.st_mtime else (path_b, "newer mtime")
    if stat_a.st_size != stat_b.st_size:
        return (path_a, "larger size") if stat_a.st_size > stat_b.st_size else (path_b, "larger size")
    return path_a, "repo-preferred tie"


def skill_names_from_root(root: Path) -> set[str]:
    if not root.exists():
        return set()
    names: set[str] = set()
    for child in root.iterdir():
        if not child.is_dir():
            continue
        if child.name.startswith("."):
            continue
        if (child / "SKILL.md").exists():
            names.add(child.name)
    return names


def iter_files(root: Path) -> set[Path]:
    if not root.exists():
        return set()
    return {path.relative_to(root) for path in root.rglob("*") if path.is_file()}


def merge_tree(
    repo_dir: Path,
    local_dir: Path,
    *,
    write_repo: bool,
    write_local: bool,
) -> int:
    changes = 0
    rel_paths = sorted(iter_files(repo_dir) | iter_files(local_dir))
    for rel_path in rel_paths:
        repo_file = repo_dir / rel_path
        local_file = local_dir / rel_path
        if repo_file.exists() and not local_file.exists():
            if write_local:
                copy_file(repo_file, local_file)
                changes += 1
            continue
        if local_file.exists() and not repo_file.exists():
            if write_repo:
                copy_file(local_file, repo_file)
                changes += 1
            continue
        if not repo_file.exists() or not local_file.exists():
            continue
        if files_equal(repo_file, local_file):
            continue
        preferred, reason = prefer_file(repo_file, local_file)
        log(f"resolved skill file divergence for {rel_path} using {reason}")
        if write_repo:
            copy_file(preferred, repo_file)
            changes += 1
        if write_local:
            copy_file(preferred, local_file)
            changes += 1
    return changes


def import_legacy_repo_layout(repo_root: Path) -> None:
    canonical = repo_root / "skills"
    canonical.mkdir(parents=True, exist_ok=True)
    for child in repo_root.iterdir():
        if not child.is_dir():
            continue
        if child.name.startswith("."):
            continue
        if child.name in {"bin", "scripts", "templates", "skills"}:
            continue
        if not (child / "SKILL.md").exists():
            continue
        target = canonical / child.name
        if target.exists():
            merge_tree(target, child, write_repo=True, write_local=False)
            shutil.rmtree(child)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(child), str(target))


def count_skill_dirs(root: Path) -> int:
    return len(skill_names_from_root(root))


def write_last_sync(repo_root: Path, mode: str) -> None:
    content = (
        f"Last Sync: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Mode: {mode}\n"
        f"Host: {platform.node() or 'unknown-host'}\n"
        f"Shared Skills: {count_skill_dirs(repo_root / 'skills')}\n"
    )
    write_bytes(repo_root / "last-sync.txt", content.encode("utf-8"))


def clone_remote_snapshot(temp_root: Path) -> Path:
    origin = run(["git", "-C", str(REPO_ROOT), "remote", "get-url", "origin"], capture_output=True).stdout.strip()
    if not origin:
        raise SyncError("missing origin remote")
    clone_dir = temp_root / "repo"
    run(["git", "clone", "--quiet", "--branch", "main", "--single-branch", origin, str(clone_dir)])
    run(["git", "-C", str(clone_dir), "config", "user.name", DEFAULT_AUTHOR_NAME])
    run(["git", "-C", str(clone_dir), "config", "user.email", DEFAULT_AUTHOR_EMAIL])
    return clone_dir


def repo_has_changes(repo_root: Path) -> bool:
    return bool(run(["git", "-C", str(repo_root), "status", "--porcelain"], capture_output=True).stdout.strip())


def best_effort_update_working_repo() -> None:
    if run(["git", "-C", str(REPO_ROOT), "status", "--porcelain"], capture_output=True).stdout.strip():
        log("skipping local repo update because the working tree is dirty")
        return
    run(["git", "-C", str(REPO_ROOT), "pull", "--rebase", "origin", "main"])


def harvest_targets_into_repo(repo_root: Path) -> dict[str, int]:
    canonical = repo_root / "skills"
    canonical.mkdir(parents=True, exist_ok=True)
    import_legacy_repo_layout(repo_root)

    results: dict[str, int] = {}
    for target in TARGETS:
        target_changes = 0
        for skill_name in skill_names_from_root(target.root):
            target_changes += merge_tree(canonical / skill_name, target.root / skill_name, write_repo=True, write_local=False)
        results[target.name] = target_changes
    return results


def restore_repo_to_targets(repo_root: Path) -> dict[str, int]:
    canonical = repo_root / "skills"
    results: dict[str, int] = {}
    for target in TARGETS:
        target_changes = 0
        for skill_name in skill_names_from_root(canonical):
            target_changes += merge_tree(canonical / skill_name, target.root / skill_name, write_repo=False, write_local=True)
        results[target.name] = target_changes
    return results


def run_sync(mode: str, *, allow_dirty: bool = False, no_push: bool = False) -> None:
    if LOCK_DIR.exists():
        raise SyncError("another skills sync is already running")
    if not allow_dirty and run(["git", "-C", str(REPO_ROOT), "status", "--porcelain"], capture_output=True).stdout.strip():
        raise SyncError("working repo is dirty; commit or stash local changes before automated sync")

    LOCK_DIR.mkdir(parents=True, exist_ok=False)
    try:
        for attempt in range(1, 3):
            with tempfile.TemporaryDirectory(prefix="harness-skills-sync-") as temp_dir_name:
                temp_root = Path(temp_dir_name)
                log(f"starting {mode} sync attempt {attempt}")
                clone_dir = clone_remote_snapshot(temp_root)
                harvest_results = harvest_targets_into_repo(clone_dir)
                restore_results = restore_repo_to_targets(clone_dir)
                write_last_sync(clone_dir, mode)

                if not repo_has_changes(clone_dir):
                    log("no skill changes detected")
                    best_effort_update_working_repo()
                    return

                run(["git", "-C", str(clone_dir), "add", "-A"])
                commit_message = f"Skill backup: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} @ {platform.node() or 'unknown-host'}"
                run(["git", "-C", str(clone_dir), "commit", "--quiet", "-m", commit_message])
                if no_push:
                    log("created skill backup commit locally in the temp clone and skipped push")
                    return

                push_result = run(["git", "-C", str(clone_dir), "push", "origin", "main"], capture_output=True, check=False)
                if push_result.returncode == 0:
                    best_effort_update_working_repo()
                    log(
                        "sync complete "
                        f"(harvested={harvest_results}, restored={restore_results})"
                    )
                    return
                stderr = (push_result.stderr or "").lower()
                if attempt == 1 and ("fetch first" in stderr or "non-fast-forward" in stderr):
                    log("remote changed during sync; retrying")
                    continue
                raise SyncError(push_result.stderr.strip() or "git push failed")
        raise SyncError("sync failed after retry")
    finally:
        shutil.rmtree(LOCK_DIR, ignore_errors=True)


def run_restore(force: bool) -> None:
    if not force:
        reply = input("Restore shared skills into all harnesses? Type 'yes' to continue: ").strip()
        if reply != "yes":
            raise SyncError("restore cancelled")
    import_legacy_repo_layout(REPO_ROOT)
    results = restore_repo_to_targets(REPO_ROOT)
    log(f"restore complete (restored={results})")


def render_template(name: str, replacements: dict[str, str]) -> str:
    content = (REPO_ROOT / "templates" / name).read_text(encoding="utf-8")
    for key, value in replacements.items():
        content = content.replace(key, value)
    return content


def install_symlink(target: Path, link_path: Path) -> None:
    link_path.parent.mkdir(parents=True, exist_ok=True)
    if link_path.is_symlink() or link_path.exists():
        if link_path.is_symlink() and Path(os.path.realpath(link_path)) == target:
            return
        if link_path.is_dir() and not link_path.is_symlink():
            raise SyncError(f"cannot replace directory at {link_path}")
        link_path.unlink()
    link_path.symlink_to(target)


def install_launch_agent() -> None:
    plist_path = Path.home() / "Library" / "LaunchAgents" / "com.txhno.harness-skills-sync.plist"
    plist_path.parent.mkdir(parents=True, exist_ok=True)
    plist_path.write_text(
        render_template("com.txhno.harness-skills-sync.plist", {"__HOME__": str(Path.home())}),
        encoding="utf-8",
    )
    run(["launchctl", "unload", str(plist_path)], check=False)
    run(["launchctl", "load", str(plist_path)])


def install_systemd_units() -> None:
    user_dir = Path.home() / ".config" / "systemd" / "user"
    user_dir.mkdir(parents=True, exist_ok=True)
    (user_dir / "harness-skills-sync.service").write_text(
        render_template("harness-skills-sync.service", {"__HOME__": str(Path.home())}),
        encoding="utf-8",
    )
    (user_dir / "harness-skills-sync.timer").write_text(
        render_template("harness-skills-sync.timer", {"__HOME__": str(Path.home())}),
        encoding="utf-8",
    )
    run(["systemctl", "--user", "daemon-reload"])
    run(["systemctl", "--user", "enable", "--now", "harness-skills-sync.timer"])


def run_install(skip_sync: bool) -> None:
    run(["git", "-C", str(REPO_ROOT), "config", "user.name", DEFAULT_AUTHOR_NAME])
    run(["git", "-C", str(REPO_ROOT), "config", "user.email", DEFAULT_AUTHOR_EMAIL])
    install_symlink(REPO_ROOT / "bin" / "harness-skills-sync", Path.home() / ".local" / "bin" / "harness-skills-sync")
    install_symlink(REPO_ROOT / "bin" / "harness-skills-install", Path.home() / ".local" / "bin" / "harness-skills-install")

    if not skip_sync:
        run_sync("bootstrap", allow_dirty=True)

    if sys.platform == "darwin":
        install_launch_agent()
    elif sys.platform.startswith("linux"):
        install_systemd_units()
    else:
        log(f"skipping scheduler install on unsupported platform: {sys.platform}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Cross-device harness skill sync")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync_parser = subparsers.add_parser("sync", help="Fetch, merge, restore, commit, and push")
    sync_parser.add_argument("--allow-dirty", action="store_true")
    sync_parser.add_argument("--no-push", action="store_true")
    sync_parser.add_argument(
        "--mode",
        choices=("manual", "bootstrap", "timer"),
        default="manual",
    )

    restore_parser = subparsers.add_parser("restore", help="Restore repo skills into all harness roots")
    restore_parser.add_argument("--force", action="store_true")

    install_parser = subparsers.add_parser("install", help="Install the sync command and scheduler")
    install_parser.add_argument("--skip-sync", action="store_true")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.command == "sync":
            run_sync(args.mode, allow_dirty=args.allow_dirty, no_push=args.no_push)
        elif args.command == "restore":
            run_restore(args.force)
        elif args.command == "install":
            run_install(args.skip_sync)
        else:
            parser.error(f"unsupported command: {args.command}")
    except SyncError as exc:
        log(str(exc))
        return 1
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else ""
        log(stderr or str(exc))
        return exc.returncode or 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
