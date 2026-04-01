## Commands And Patterns

### Trending repos

Use GitHub Trending daily when the user wants repo ideas:

- `https://github.com/trending?since=daily`

If you need to inspect the rendered repo list locally:

```bash
python - <<'PY'
import requests
from bs4 import BeautifulSoup
html = requests.get(
    "https://github.com/trending?since=daily",
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=20,
).text
soup = BeautifulSoup(html, "html.parser")
for i, article in enumerate(soup.select("article.Box-row"), 1):
    h2 = article.select_one("h2 a")
    if not h2:
        continue
    repo = "/".join(part.strip() for part in h2.get_text(" ", strip=True).split("/"))
    print(i, repo, "https://github.com" + h2["href"])
PY
```

### Repo and issue inspection

```bash
gh repo view OWNER/REPO --json name,description,defaultBranchRef,url,isFork
gh issue list --repo OWNER/REPO --state open --limit 100 --json number,title,createdAt,comments,reactionGroups,labels,url
gh issue view ISSUE --repo OWNER/REPO
gh pr list --repo OWNER/REPO --state open --limit 50 --json number,title,url,headRefName
gh issue list --repo OWNER/REPO --state all --search 'TERM in:title,body' --limit 50 --json number,title,state,url
```

### Fork setup

Preferred if it works:

```bash
gh repo fork OWNER/REPO --clone --default-branch-only /path/to/repo
```

Fallback when `gh repo fork --clone` fails due to the wrong GitHub SSH host:

```bash
gh repo fork OWNER/REPO
git clone --branch DEFAULT_BRANCH --single-branch https://github.com/txhno/REPO.git /path/to/repo
git -C /path/to/repo remote add upstream https://github.com/OWNER/REPO.git
git -C /path/to/repo remote set-url origin git@github-txhno:txhno/REPO.git
git -C /path/to/repo config remote.pushDefault origin
git -C /path/to/repo config branch.DEFAULT_BRANCH.remote upstream
git -C /path/to/repo config branch.DEFAULT_BRANCH.merge refs/heads/DEFAULT_BRANCH
git -C /path/to/repo remote -v
```

### Local Git identity

Set per repo:

```bash
git -C /path/to/repo config user.name "txhno"
git -C /path/to/repo config user.email "198242577+txhno@users.noreply.github.com"
```

### Typical contribution flow

```bash
git -C /path/to/repo checkout -b fix/short-description
# edit files
git -C /path/to/repo add PATHS...
git -C /path/to/repo commit -m "type(scope): concise message"
git -C /path/to/repo push -u origin BRANCH
gh pr create --repo OWNER/REPO --base DEFAULT_BRANCH --head txhno:BRANCH --title "..." --body $'...'
```

### Rebase branch when needed

```bash
git -C /path/to/repo fetch upstream DEFAULT_BRANCH
git -C /path/to/repo rebase upstream/DEFAULT_BRANCH
git -C /path/to/repo push --force-with-lease origin BRANCH
```

If `--force-with-lease` fails due to missing remote-tracking state in a single-branch clone:

```bash
git -C /path/to/repo fetch origin refs/heads/BRANCH:refs/remotes/origin/BRANCH
git -C /path/to/repo push --force-with-lease=refs/heads/BRANCH:OLD_SHA origin BRANCH
```

### CI triage

```bash
gh pr checks PR_NUMBER --repo OWNER/REPO
gh run view RUN_ID --repo OWNER/REPO --job JOB_ID --log-failed
git -C /path/to/repo diff --name-only upstream/DEFAULT_BRANCH...HEAD
git -C /path/to/repo diff --stat upstream/DEFAULT_BRANCH...HEAD
```

Use those commands before claiming a branch broke CI.

### PR and issue comments

After approval from the user:

```bash
gh issue comment ISSUE --repo OWNER/REPO --body "ive fixed it here: PR_LINK"
gh pr comment PR_NUMBER --repo OWNER/REPO --body "..."
```

### Post-PR follow-up sweep

Use these after waiting about 5-10 minutes for checks and bots to populate:

```bash
gh pr checks PR_NUMBER --repo OWNER/REPO
gh pr view PR_NUMBER --repo OWNER/REPO --comments
gh pr view PR_NUMBER --repo OWNER/REPO --json reviewRequests,reviews,comments,mergeStateStatus,url
```

If checks are failing, inspect the exact jobs before deciding the branch caused them:

```bash
gh run view RUN_ID --repo OWNER/REPO --job JOB_ID --log-failed
```

If review comments arrive, summarize them first and ask before force-pushing follow-up changes unless the user already said to keep going.
