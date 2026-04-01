---
name: oss-contribution-playbook
description: "Find and execute a clean open-source contribution workflow: discover trending repos, shortlist good issues, verify they are open and not duplicate or already claimed, set up a fork, prepare a minimal fix, handle review and CI, and pause for user approval before issue selection, code edits, and PR submission. Use when the user wants to contribute to OSS without AI code slop, wants help choosing an issue, or wants a disciplined fork/branch/PR workflow."
---

# Oss Contribution Playbook

## Overview

Use this skill to run a disciplined OSS contribution workflow with explicit stop points. Default behavior is not "find something and ship a PR immediately". Default behavior is:

1. Inspect trending repos or a user-specified repo.
2. Shortlist good issues.
3. Pause and ask the user which issue to pursue.
4. Diagnose the chosen issue.
5. Pause and ask before editing.
6. Implement a minimal fix with no AI slop.
7. Validate locally as far as the environment allows.
8. Pause and ask before push / PR / issue comments.

Read [references/commands-and-patterns.md](references/commands-and-patterns.md) when you need exact CLI patterns.

## Local Defaults

Use these local defaults unless the user explicitly overrides them:

- GitHub username: `txhno`
- Git author name: `txhno`
- Git author email: `198242577+txhno@users.noreply.github.com`
- Preferred fork push remote form: `git@github-txhno:txhno/<repo>.git`
- Preferred upstream fetch remote form: `https://github.com/<owner>/<repo>.git`
- `gh` is authenticated on this machine

Configure `user.name` and `user.email` per-repository, not globally, unless the user explicitly asks for global config.

## Mandatory Pause Points

Always stop and ask a concise direct question at these checkpoints unless the user explicitly told you to skip pauses for that turn.

### Pause 1: After issue shortlist

After reviewing repos and issues, present up to 3 candidates with:

- issue number and link
- why it is a good target
- why it is likely small
- whether comments suggest maintainer openness
- whether there is an existing PR or duplicate risk

Then ask: `Which one should I do?`

### Pause 2: After diagnosis, before editing

After reproducing or code-reading enough to propose a fix shape, summarize:

- root cause
- files likely to change
- validation plan

Then ask: `Proceed with the fix?`

### Pause 3: After validation, before push / PR / comments

After local validation, summarize:

- what changed
- what was tested
- any limitations

Then ask: `Push this branch and open the PR?`

### Pause 4: Before force-push or substantial PR updates

If review feedback requires amending history, force-pushing, deleting tests from a PR, or changing PR scope, ask first unless the user already directly instructed that exact follow-up.

## Repo Discovery Workflow

### If the user names a repo

Use that repo directly. Do not browse trending first.

### If the user wants a repo suggestion

Check GitHub Trending daily first. Prefer repos that:

- have active issue trackers
- have recent maintainer replies
- show small, well-scoped bug or docs issues
- do not require heavy product decisions

Avoid repos where the top open items are only:

- major feature requests
- long-running architecture discussions
- issues already claimed with an active PR

## Issue Selection Rules

For every candidate issue:

1. Read the full issue body.
2. Read the comment thread before choosing it.
3. Check open PRs for overlapping work.
4. Search open and closed issues for likely duplicates.
5. Reject the issue if:
   - it is closed
   - it is clearly a duplicate of a closed or active issue/PR
   - a maintainer already rejected the idea
   - another contributor is actively working it unless the user wants to collaborate

Prefer issues where comments say things like:

- `feel free to open a PR`
- `contributions welcome`
- clear maintainer guidance on the expected fix

Prefer the smallest good fix over the most upvoted item. High reaction count is useful, but only after the issue passes the small-scope and non-duplicate checks.

## Fork And Checkout Workflow

Set repositories up in fork style:

- `origin` = user's fork
- `upstream` = original repo

Use the repo's actual default branch, not assumptions like `main`.

### Preferred flow

1. Create the fork with `gh repo fork`.
2. If `gh repo fork --clone` fails because GitHub SSH uses the wrong host alias, fall back to:
   - clone the fork over HTTPS
   - rewrite `origin` to `git@github-txhno:...`
   - add `upstream` as HTTPS
3. Set the local branch to pull from `upstream`.

Do not rewrite the user's installed software or running services just to make a source checkout. Keep source forks separate from production installs.

## Branching Rules

- Create a narrow branch name that describes the fix.
- Base it from the repo's default branch.
- Keep one issue per branch.
- Do not mix cleanup or unrelated fixes into the same branch.

## No-Slop Coding Rules

Check the diff against the base branch and remove AI code slop. This includes:

- extra comments a human would not add
- extra defensive checks or try/catch blocks that are abnormal for that area
- `any` casts or similar type escapes
- style inconsistent with the file
- broad refactors when the issue needs a small fix

Keep fixes minimal, local, and style-matched to the file.

When replying about code changes or PR updates, keep summaries short. If the user asks for a review-style answer, prioritize findings first.

## Implementation Workflow

### Diagnose first

Use the smallest reliable path:

- read the issue
- inspect the relevant files
- search nearby tests
- inspect existing patterns in the same subsystem

Do not start patching until the failure mode is coherent.

### Patch narrowly

Prefer one focused change. Touch tests only when:

- the repo already uses tests there
- the bug can be validated cheaply
- adding the test is normal for that code area

Do not add large new harnesses for a small fix.

### Validate honestly

Run the smallest meaningful validation:

- targeted test
- build of the touched component
- syntax check if full build tooling is unavailable

If local validation is limited by the environment, say that directly.

## PR Workflow

When the user approves push/PR:

1. Push branch to `origin`.
2. Open PR against `upstream` default branch.
3. Keep title and body concise.
4. Link the issue if appropriate.
5. If useful, post a short issue comment: `ive fixed it here: <pr-link>`

Do not post comments on the issue or PR until the user has approved the push/PR checkpoint, unless they explicitly asked you to do so.

## Post-PR Monitoring

After opening a PR, do not assume the work is finished immediately. GitHub checks and bot reviews usually lag.

### Wait window

After PR creation, wait roughly 5-10 minutes before doing the first serious follow-up sweep unless the user explicitly wants instant polling.

### What to check

- PR checks status
- failing workflow logs
- code review comments
- bot comments
- maintainer comments
- mergeability / out-of-date status

### Required behavior

Do not silently patch follow-up issues right away.

After the post-PR sweep:

1. summarize any failing checks or review comments
2. separate branch-caused problems from unrelated CI failures
3. propose the exact follow-up fix
4. pause and ask before making more changes

If the user explicitly tells you to keep going automatically after PR creation, you may continue through review-fix loops, but still keep changes narrow and report each push.

## CI And Review Workflow

### If CI fails

Do not assume the branch caused it.

Check:

- changed files in the branch
- failing CI job logs
- whether failures are in unrelated files or flaky areas

If the failures are unrelated, say so concretely with file names and failing tests. Do not "fix the world" unless the user asks.

### If the branch is out of date

If GitHub says the branch is out of date but mergeable, it is not urgent. Rebase only if:

- the user asks
- maintainers request it
- CI clearly needs latest base

### If code review comments arrive

Handle them tightly:

- fix only the review point
- avoid widening scope
- if requested, remove extras not required for the fix
- if force-pushing, ask first unless already instructed

## Communication Rules

Be direct and brief. Do not oversell.

When shortlisting issues, include:

- why this is small
- why this is not obviously duplicated
- whether comments or PRs suggest it is still available

When closing a contribution step, use only a 1-3 sentence summary unless the user explicitly asks for more.

## Exact Things To Remember

- Always inspect comments before choosing an issue.
- Always inspect open PRs before choosing an issue.
- Always search related open/closed issues before choosing an issue.
- Favor maintainer-blessed small bugs over popular large features.
- Keep `origin` as the user's fork and `upstream` as the canonical repo.
- Use local repo Git identity:
  - `user.name = txhno`
  - `user.email = 198242577+txhno@users.noreply.github.com`
- Prefer `git@github-txhno:txhno/<repo>.git` for fork pushes on this machine.
- Do not push or open PRs without an approval pause.
