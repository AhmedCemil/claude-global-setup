#!/usr/bin/env python3
"""Print the Claude 5-hour rate-limit utilization % to stdout.

Reads credentials (SESSION_KEY, DEVICE_ID, ORG_ID) from a .env file. Fully
portable — NO absolute paths are hardcoded. Locations are resolved at runtime
from the home dir and the script's own location, first match wins:
    1. $CLAUDE_LIMIT_ENV               (optional explicit override)
    2. ~/.claude/claude_usage.env      (the standard self-contained location)
    3. <script dir>/claude_usage.env   (so the portable set works pre-install)
    4. <script dir>/../claude_usage.env

To use on any machine: copy your .env to ~/.claude/claude_usage.env (or set
CLAUDE_LIMIT_ENV). No code edit, no machine-specific path.

Caches the API response in ~/.claude/.limit_cache.json for 30 seconds so
back-to-back calls don't hammer the API.

Output:
    Single line, e.g. "42.3" or "42.3 (resets in 1h23m)" with --verbose.
    Exit 0 on success, 1 on any error (with stderr message).
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude"
SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_PATH = CLAUDE_DIR / ".limit_cache.json"
CACHE_TTL_SECONDS = 30
API_TIMEOUT = 15


def env_candidates() -> list[Path]:
    """Portable .env locations, all derived from home dir or this script's path."""
    candidates: list[Path] = []
    override = os.environ.get("CLAUDE_LIMIT_ENV")
    if override:
        candidates.append(Path(override))
    candidates.append(CLAUDE_DIR / "claude_usage.env")
    candidates.append(SCRIPT_DIR / "claude_usage.env")
    candidates.append(SCRIPT_DIR.parent / "claude_usage.env")
    return candidates


def find_env_path() -> Path:
    for path in env_candidates():
        if path.exists():
            return path
    searched = "\n  ".join(str(c) for c in env_candidates())
    raise FileNotFoundError(
        "claude_usage.env not found. Set $CLAUDE_LIMIT_ENV or place it at "
        "~/.claude/claude_usage.env. Searched:\n  " + searched
    )


def load_env() -> dict[str, str]:
    env_path = find_env_path()
    env: dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def read_cache() -> dict | None:
    if not CACHE_PATH.exists():
        return None
    try:
        data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    if time.time() - data.get("cached_at", 0) > CACHE_TTL_SECONDS:
        return None
    return data.get("payload")


def write_cache(payload: dict) -> None:
    try:
        CACHE_PATH.write_text(
            json.dumps({"cached_at": time.time(), "payload": payload}),
            encoding="utf-8",
        )
    except OSError:
        pass


def fetch_usage(env: dict[str, str]) -> dict:
    session_key = env.get("SESSION_KEY")
    org_id = env.get("ORG_ID")
    if not session_key or not org_id:
        raise RuntimeError("SESSION_KEY or ORG_ID missing from .env")

    url = f"https://claude.ai/api/organizations/{org_id}/usage"
    req = urllib.request.Request(url)
    req.add_header("Cookie", f"sessionKey={session_key}")
    req.add_header("User-Agent", "claude-limit-script/1.0")

    with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def format_resets_at(resets_at: str) -> str:
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(resets_at.replace("Z", "+00:00"))
        delta = dt - datetime.now(timezone.utc)
        total = int(delta.total_seconds())
        if total <= 0:
            return "resetting now"
        hours, rem = divmod(total, 3600)
        minutes = rem // 60
        if hours:
            return f"resets in {hours}h{minutes:02d}m"
        return f"resets in {minutes}m"
    except Exception:
        return f"resets at {resets_at}"


def main(argv: list[str]) -> int:
    verbose = "--verbose" in argv or "-v" in argv

    cached = read_cache()
    if cached is not None:
        payload = cached
    else:
        try:
            env = load_env()
            payload = fetch_usage(env)
            write_cache(payload)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, RuntimeError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        except Exception as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1

    five = payload.get("five_hour") or {}
    utilization = five.get("utilization")
    if utilization is None:
        print("ERROR: five_hour.utilization missing from API response", file=sys.stderr)
        return 1

    try:
        pct_value = float(utilization)
    except (TypeError, ValueError):
        print(f"ERROR: utilization not numeric: {utilization!r}", file=sys.stderr)
        return 1

    if verbose:
        resets_at = five.get("resets_at")
        suffix = f" ({format_resets_at(resets_at)})" if resets_at else ""
        print(f"{pct_value:.1f}{suffix}")
    else:
        print(f"{pct_value:.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
