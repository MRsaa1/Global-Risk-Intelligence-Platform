# Push to GitHub (MRsaa1)

Security: `.gitignore` excludes `.env`, secrets, keys, tokens, and credential JSONs. Do not commit those files.

## Your current remote

```
origin  https://github.com/MRsaa1/Global-Risk-Intelligence-Platform.git
```

## Commands (run from repo root)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform

# Remove stale lock if git says "index.lock exists"
rm -f .git/index.lock

# Stage all (ignored files stay excluded)
git add -A

# Quick check: ensure no .env or keys are staged
git diff --cached --name-only | grep -E '\.env$|\.key$|secret|credentials\.json' || true
# If anything appears above, unstage it: git restore --staged <file>

# Commit (English)
git commit -m "Platform updates: GEE integration, security, docs, API and web app"

# Push to your repo
git push -u origin main
```

## If your default branch is `master`

```bash
git push -u origin master
```

## Using SSH

```bash
git remote set-url origin git@github.com:MRsaa1/Global-Risk-Intelligence-Platform.git
git push -u origin main
```
