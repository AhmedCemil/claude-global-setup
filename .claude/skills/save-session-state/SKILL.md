---
name: save-session-state
description: Save current session state to memory and report BOTH walls — the 5-hour rate-limit % and the real context-window usage. Invoke before dispatching big subagents, after heavy agents return, when the user asks to "save state", or whenever a checkpoint is useful. Appends a timestamped checkpoint to the active project's MEMORY.md and reports current 5h limit % + context tokens.
---

# save-session-state

## Purpose

A checkpoint reads **both walls** that can stop us, then records where we are:

1. **5-hour rate-limit %** — how close we are to the usage wall (resets on a clock).
2. **Context-window usage** — how full *this conversation* is. This is the wall **compaction actually frees**. Reporting it is the point: "should we compact?" is a context question, not a rate-limit question — without this number the advice is blind.
3. **Record a timestamped checkpoint** so a fresh session after `/compact` or rate-limit can resume cleanly.

Two independent walls: you can be low on one and high on the other. Both belong in every checkpoint.

## When to invoke

- Before dispatching a big subagent (so we know if there's headroom)
- After a heavy subagent returns (capture state right after expensive work)
- When the user says "save state" / "checkpoint" / "before we hit limit"
- Periodically during long sessions (e.g. once an hour)

Don't invoke on every tool call — the API call is cheap (cached 30s) but the checkpoint text adds noise. Use judgment.

## Steps to execute

### 1. Get the rate-limit %

Run (resolve `~` to the user's home dir — don't hardcode a drive path):
```bash
python ~/.claude/scripts/claude_limit_percent.py --verbose
```
On Windows PowerShell, `~` expands correctly; if a tool needs an absolute path, build it from `$HOME` / `$env:USERPROFILE`, never a literal `C:\Users\...`.

Expected stdout: a single line like `42.3 (resets in 1h23m)`. Exit 0.

If exit is non-zero (session cookie expired, network down, etc.), capture the stderr message and continue with "limit %: unavailable" — this skill must NOT block on the API call.

### 2. Get the real context-window usage

Run (resolve `~` from `$HOME`/`$env:USERPROFILE`, never a literal drive path):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ~/.claude/scripts/context_usage.ps1 -Headline
```

Expected stdout: a single line like `56.1k / 1m (6%)`. Exit 0.

How it works (and why it's safe to run anytime): it reads the **current project's newest session transcript** (JSONL) and takes the token counts the harness already recorded there. No `claude` spawn, no fork, nothing written — real numbers, zero side effects, free, milliseconds. The project folder is auto-derived from the current directory; no hardcoded path, and `claude` need not be on PATH.

I (Claude) **cannot** read my own `/context` natively — the Skill tool rejects it as a built-in CLI command — so this fork-read is the only way to get the genuine figure mid-session. The chars/4 estimate is NOT a substitute; use this.

If exit is non-zero (e.g. `claude` not on PATH, no session yet), continue with "context: unavailable" — this skill must NOT block on it.

### 3. Write the checkpoint to the project's MEMORY.md

**Memory lives in the project's own folder as a single `MEMORY.md`** (no global memo dir). Append a short checkpoint block to the END of the active project's `MEMORY.md`. If unclear which project is active, ask the user one short question before writing. Don't create a separate checkpoint/MEMO file — `MEMORY.md` is the one file.

Checkpoint body format — keep it under 5 lines:

```markdown
**Checkpoint YYYY-MM-DD HH:MM** — 5h limit: XX.X% (resets in NhNNm) · context: NNk/1m (P%)
- <one line: what just finished>
- <one line: what's next, if known>
```

Don't write secrets, full transcripts, or huge diffs. The checkpoint is for "where are we", not "what was said". If unclear which project is active, ask the user one short question before writing.

### 4. Report back

One short message to the user, no fluff:

```
Saved at HH:MM. 5h limit XX.X% (resets in NhNNm) · context NNk/1m (P%).
```

If 5h limit > 80%: add `⚠ near 5h limit — consider deferring big agents`.

If a fetch failed, report the one that worked and mark the other unavailable, e.g.
`Saved at HH:MM. 5h limit unavailable (<reason>) · context 56k/1m (6%).`

### Context gates — a judgment at each gate, NOT a flat threshold

Context cost is **local but global**: a session's context lives in its own 1M window, but a fat
context re-sends on every turn, draining the *shared* 5h pool faster — so a heavy session taxes
*all* concurrent sessions. That's why we warn early. At each gate, DO the check — don't just print:

- **≥30% — "should we?" gate.** Warn the user AND review my todos / current work. Then *judge*:
  - Safe point (between tasks, no detail at risk)? → propose compacting; the user pulls the lever.
  - Compacting now would harm (mid-task, detail still needed)? → say so explicitly, continue to the 50% gate.
- **30–50% — "continue" zone.** Only here because 30% was judged unsafe. Push on; re-check at 50%.
- **≥50% — "why aren't we?" gate.** Default now LEANS toward compacting — waiting costs more than acting.
  Note honestly: the save itself (read + write + this warning) can nudge us toward 60%, so 50% is the
  real last-safe-checkpoint, not 60%. If still genuinely unsafe, flag that the next stop is hard.
- **≥60% — HARD STOP.** Non-negotiable: must compact before continuing. State this plainly.

I cannot run `/compact` myself (built-in CLI command — Skill tool rejects it, same as `/context`).
My job at these gates is to **measure, judge, and recommend**; the **user pulls the lever**. Never
auto-compact — it summarizes away detail the user may still need, and that's their call (and their
CLAUDE.md says: safe checkpoints only, never mid-task, on the user's signal).

## Notes

- **Per-account.** The reported % is for the account Claude Code is logged in as RIGHT NOW. The script derives the active label itself — live login (`~/.claude.json` → `oauthAccount.organizationUuid`) matched against each stored `~/.claude/claude_creds/store/<label>/identity.json`. Same rule the account switcher uses, but with no dependency on it (no PowerShell call): no state file, correct even after a manual `/login` or an account switch.
- The script reads a `.env` with keys `SESSION_KEY`, `DEVICE_ID`, `ORG_ID`. Lookup order, first match wins: `$CLAUDE_LIMIT_ENV` → `~/.claude/claude_env/claude_usage - <label>.env` (per-account) → `~/.claude/claude_usage.env` (legacy single-account) → locations relative to the script. A one-account install keeps working unchanged. If the session cookie expires, the user refreshes it manually — the script fails soft and the skill still saves state.
- `--verbose` appends the account: `59.0 (resets in 24m · account: acbclaudeai)`. **Report which account the number belongs to** when more than one is configured.
- **`0.0` with NO reset time means the number is not real** — the env file for that account was missing, or its `SESSION_KEY` expired. A genuinely idle window still reports a `resets_at`. Distrust a bare `0.0` and check which env file resolved before reporting it.
- Cache TTL is 30s and the cache is **keyed per account** (`~/.claude/.limit_cache-<label>.json`), so switching accounts never serves the previous account's number.
