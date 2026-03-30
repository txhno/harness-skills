# Harness Skills

Shared cross-device skill repo for:

- Claude Code
- Codex
- Droid
- Cursor

The canonical repo format is:

```text
skills/<skill-name>/...
```

Every sync runs remote-first:

1. fetch current repo state
2. merge any locally-added skills from the supported harness roots into the canonical `skills/` tree
3. restore the canonical `skills/` tree back into every harness root
4. commit and push the union result

This is union-based sync. It does not delete skills from other devices.

## Local Skill Roots

- Claude: `~/.claude/skills`
- Codex: `~/.codex/skills`
- Droid: `~/.openclaw/skills`
- Cursor: `~/.cursor/skills-cursor`

Hidden/system skill directories are excluded from harvesting. Shared skills are restored as normal skill folders into all four harness roots.

## Install

```bash
./install.sh
```

That:

- installs `harness-skills-sync` and `harness-skills-install` into `~/.local/bin`
- sets repo-local git author to your personal Git identity
- runs a bootstrap sync so repo skills are restored first and local additions are merged in
- installs an hourly scheduler

## Restore Only

```bash
./restore.sh
./restore.sh --force
```

This restores the canonical repo skills into all harness roots without pushing.

## Scheduler

### macOS
- `~/Library/LaunchAgents/com.txhno.harness-skills-sync.plist`

### Linux
- `~/.config/systemd/user/harness-skills-sync.service`
- `~/.config/systemd/user/harness-skills-sync.timer`
