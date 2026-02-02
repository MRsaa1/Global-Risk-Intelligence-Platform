# Brief for developer — repo sync, English-only, security

Use this brief when working on this repository. Your task is to get access, bring the repo up to date, and keep everything in **English** and **secure**.

---

## 1. Repository

- Work on the **main** branch (or the one the owner specifies).
- Use **SSH** for clone/push. Do not put GitHub tokens or API keys in the remote URL.
- Example: `git remote -v` should show `git@github.com:...`, not `https://.../token@...`.

---

## 2. What should be done (and kept up to date)

### Language

- All content in **English**: README, code comments, API messages, UI strings, configs, and docs.
- No committed text in other languages in user-facing or doc content (except where explicitly required, e.g. localized UI files).

### README

- **Live Demo / Production URL** must point to the **correct production URL** (domain or server the owner specifies).
- No outdated or wrong IPs/URLs in README or docs.

### Security

- Remote URL must use **SSH** (no tokens in `git remote -v`).
- **.gitignore** must exclude:
  - `.env`, local configs with secrets
  - Binaries, build artifacts, `*.tar.gz`
  - **Runtime logs** (e.g. `*.log`, `logs/`)
  - Patterns like `*api_key*`, `*secret*`, `*password*`, `ghp_*`, etc.
- No API keys, tokens, or passwords in the repo — only in environment variables or secure config (e.g. `.env` not committed).
- **Config:** If there is an `ecosystem.config.js` (or similar) that reads secrets, only a **safe example** (e.g. `ecosystem.config.js.example` or `.env.example` with placeholders only) should be in the repo; the real file must stay out of version control.

When you add or change anything, keep: **English-only**, correct production URL in README, and **no secrets** in the repo.

---

## 3. Your steps

1. Clone/pull the repo (SSH) and confirm you can push.
2. **Check:**
   - README has the correct Live Demo / Production URL.
   - No non-English text in README, code, UI, or API messages (unless intentional).
   - No `.env`, tokens, or API keys committed; remote URL has no secrets.
3. Update code, dependencies, and docs as needed. Keep everything in English and compliant with the security rules above.
4. Commit and push with clear messages (e.g. `README: fix production URL`, `i18n: English only`, `Security: update .gitignore`).

---

## 4. Security rules (mandatory)

- **Do not commit:** `.env`, files that contain or read API keys/tokens/passwords, or any secrets.
- **Do not store** GitHub (or other) tokens in git remote URLs; use SSH or a proper credential helper.
- Keep **.gitignore** so that secrets, binaries, and build artifacts are never tracked.
- If you find a secret in the repo or history, remove it and **consider the key compromised (rotate it)**.

---

## 5. What the owner will provide separately

- Repository URL (GitHub).
- Correct production URL / domain for the Live Demo in README.
- Any access (SSH keys, permissions, or instructions) you need.

**Ask if anything is unclear before changing production URLs or anything security-sensitive.**
