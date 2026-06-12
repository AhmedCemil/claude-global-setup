# Publishing this set to GitHub + making a release zip

A step-by-step for putting `claude_global_setup` on GitHub and attaching an
easy-install `.zip`. All commands are PowerShell, run from **inside** the
`claude_global_setup` folder.

> **Private files never ship.** `.gitignore` already blocks `MEMORY.md`, the real
> `claude_usage.env`, caches, and machine state. The steps below also build the
> release zip from a clean `git archive`, so the zip can't contain anything git ignores.

---

## 0. One-time: install + sign in to the GitHub CLI (optional but easiest)

```powershell
winget install GitHub.cli      # if you don't have it
gh auth login                  # pick GitHub.com → HTTPS → login in browser
```

You can do everything without `gh` (plain `git` + the website), but `gh` makes
the repo + release one-liners. Both paths are shown.

---

## 1. Pre-flight safety check (do this every time before pushing)

From inside the folder, confirm nothing private/identifying is about to be committed:

```powershell
# nothing personal or secret in tracked files?
Select-String -Path .\* -Pattern 'SESSION_KEY=.\w|sk-ant-|ahmed|bilgin|pazarlama|DiskD' -Recurse |
  Where-Object { $_.Path -notlike '*MEMORY.md' }
# ^ expect NO output (a few empty-template / placeholder hits are fine to eyeball)

# confirm the real .env and MEMORY.md are ignored
git check-ignore .claude\claude_usage.env MEMORY.md    # run after step 2 init
```

If `Select-String` prints real values → stop and scrub before continuing.

---

## 2. Initialise the repo

```powershell
git init
git add .
git status                 # REVIEW the list — MEMORY.md and *.env should NOT appear
git commit -m "Initial commit: portable Claude Code global setup"
```

Confirm the ignore rules actually caught the private files:

```powershell
git check-ignore -v MEMORY.md .claude\claude_usage.env
# both should print a matching .gitignore line. If a real .env exists and is NOT
# listed, DO NOT push — fix .gitignore first.
```

---

## 3. Create the GitHub repo + push

### Option A — with `gh` (one line)

```powershell
gh repo create claude-global-setup --public --source=. --remote=origin --push
```

### Option B — plain git (create the empty repo on github.com first)

On the website: **New repository** → name `claude-global-setup` → **Public** →
do *not* add a README/license (you already have them) → **Create**. Then:

```powershell
git branch -M main
git remote add origin https://github.com/<your-username>/claude-global-setup.git
git push -u origin main
```

---

## 4. Build the install zip (clean, from git)

`git archive` zips **only tracked files**, so anything in `.gitignore`
(MEMORY.md, real .env) is automatically excluded — the safest way to package.

```powershell
git archive --format=zip --prefix=claude_global_setup/ -o claude_global_setup.zip HEAD
```

- `--prefix=claude_global_setup/` makes the zip extract into a single named folder
  (so it doesn't splatter files into the current directory).
- The resulting `claude_global_setup.zip` is what users download and unzip.

Sanity-check the zip's contents before publishing:

```powershell
Expand-Archive .\claude_global_setup.zip -DestinationPath .\_ziptest -Force
Get-ChildItem -Recurse .\_ziptest | Select-Object FullName
# verify: NO MEMORY.md, NO claude_usage.env (only claude_usage.env.example)
Remove-Item -Recurse -Force .\_ziptest
```

> Don't `git add` the zip itself — attach it to a Release instead (next step).
> If you ever build the zip another way, never zip the live folder blindly; it
> could pick up `MEMORY.md` or a real `.env`. `git archive` avoids that.

---

## 5. Cut a Release and attach the zip

### Option A — with `gh`

```powershell
gh release create v1.0.0 .\claude_global_setup.zip `
  --title "v1.0.0 — Claude Global Setup" `
  --notes "Portable Claude Code config + no-Python usage widget. Unzip, merge .claude into ~/.claude, see GUIDE.html."
```

### Option B — on the website

Repo → **Releases** → **Draft a new release** → Tag `v1.0.0` → Title and notes →
drag `claude_global_setup.zip` into **Attach binaries** → **Publish release**.

---

## 6. What users do (put this in the release notes)

1. Download `claude_global_setup.zip` from the release and unzip it.
2. Open **`GUIDE.html`** (or `GUIDE_TR.html`) — the full walkthrough.
3. Merge `.claude` into the home dir:
   ```powershell
   Copy-Item .\.claude\* $HOME\.claude\ -Recurse -Force
   ```
4. (Optional, for the usage %) copy `claude_usage.env.example` →
   `~/.claude/claude_usage.env` and fill in the three keys.
5. Launch Claude Code. For the widget: run `usage-widget\cuw.bat`.

---

## Updating later

```powershell
git add .
git commit -m "Describe the change"
git push
# new release with a fresh zip:
git archive --format=zip --prefix=claude_global_setup/ -o claude_global_setup.zip HEAD
gh release create v1.1.0 .\claude_global_setup.zip --title "v1.1.0" --notes "What changed"
```

## Quick reference

| Task | Command |
|------|---------|
| Check a file is ignored | `git check-ignore -v <file>` |
| See what will be committed | `git status` / `git add -n .` |
| Build clean zip | `git archive --format=zip --prefix=claude_global_setup/ -o claude_global_setup.zip HEAD` |
| Create repo + push (gh) | `gh repo create <name> --public --source=. --push` |
| Cut release (gh) | `gh release create vX.Y.Z .\claude_global_setup.zip --title "..." --notes "..."` |
