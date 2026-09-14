---
name: context-usage
description: Report the REAL context-window usage (genuine tokenizer numbers, not an estimate) for the current Claude Code session. Use when the user asks "how full is the context", "how many tokens are we using", "check context", or when deciding whether to /compact. Free, instant, no side effects.
---

# context-usage

## Purpose

Get the **real** `/context` numbers for the current conversation — the same figures `/context` shows interactively — but readable mid-session by me (Claude), and scriptable.

I **cannot** invoke `/context` on myself (the Skill tool rejects it as a built-in CLI command). And a chars/4 estimate off the transcript is NOT accurate. This skill reads the genuine number instead.

## Why it's safe to run anytime

The script reads the session's own transcript JSONL — the same data the harness already writes. Every assistant message records a `usage` block; the context in use at the last turn is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` of the most recent message carrying `cache_read_input_tokens`.

No `claude` process is spawned, no session is forked, nothing is written. Real numbers, zero side effects, free, tens of milliseconds even on multi-MB transcripts.

> It did not always work this way: an earlier version forked a session (`--fork-session --no-session-persistence`) to run `/context`. Reading the JSONL directly replaced that — no spawn, no junk sessions, and it no longer needs `claude` on PATH.

## Steps

Run via `$env:USERPROFILE` (PowerShell's `-File` parameter does **not** expand `~` — passing a literal `~/.claude/...` fails with "the argument ... does not exist"). Never hardcode a literal drive path:

```powershell
# one-line headline:
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\scripts\context_usage.ps1" -Headline

# full breakdown (categories, MCP tools, memory files, skills):
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\scripts\context_usage.ps1"
```

The script auto-detects the current project's transcript folder from the working directory (no hardcoded path) and reads its newest session. Pass a session id as the first arg to target a specific past session.

Report the headline to the user, e.g. `Context: 56k / 1m (6%)`. If context > ~60%, suggest `/compact` at the next safe checkpoint.

## Related

This is the same engine the **save-session-state** skill calls for its context reading. Use *this* skill for a quick standalone check; use *save-session-state* when you also want a checkpoint written and the 5h limit reported.
