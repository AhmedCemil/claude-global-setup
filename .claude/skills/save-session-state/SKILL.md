---
name: save-session-state
description: Save current session state to memory and report 5-hour rate-limit usage. Invoke before dispatching big subagents, after heavy agents return, when the user asks to "save state", or whenever a checkpoint is useful. Appends a timestamped checkpoint to the active project's auto-memory and reports current 5h limit %.
---

# save-session-state

## Purpose

Two jobs at a checkpoint:

1. Read the **5-hour rate-limit utilization %** so I (Claude) know how close we are to hitting the wall.
2. **Record a timestamped checkpoint** so a fresh session after `/compact` or rate-limit can resume cleanly.

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

### 2. Write the checkpoint to the project's MEMORY.md

**Memory lives in the project's own folder as a single `MEMORY.md`** (no global memo dir). Append a short checkpoint block to the END of the active project's `MEMORY.md`. If unclear which project is active, ask the user one short question before writing. Don't create a separate checkpoint/MEMO file — `MEMORY.md` is the one file.

Checkpoint body format — keep it under 5 lines:

```markdown
**Checkpoint YYYY-MM-DD HH:MM** — 5h limit: XX.X% (resets in NhNNm)
- <one line: what just finished>
- <one line: what's next, if known>
```

Don't write secrets, full transcripts, or huge diffs. The checkpoint is for "where are we", not "what was said". If unclear which project is active, ask the user one short question before writing.

### 3. Report back

One short message to the user, no fluff:

```
Saved at HH:MM. 5h limit at XX.X% (resets in NhNNm).
```

If limit > 80%: add a warning line like `⚠ near limit — consider deferring big agents`.

If limit fetch failed: `Saved at HH:MM. 5h limit unavailable (<reason>).`

## Notes

- The script reads a `.env` with keys `SESSION_KEY`, `DEVICE_ID`, `ORG_ID`. Fully portable — no hardcoded paths: it searches `$CLAUDE_LIMIT_ENV`, then `~/.claude/claude_usage.env`, then locations relative to the script itself; first found wins. On any machine, just drop the `.env` at `~/.claude/claude_usage.env`. If the session cookie expires, the user refreshes it manually — the script fails soft and the skill still saves state.
- Cache TTL is 30s, so calling this skill twice in 30s won't double-hit the API.
