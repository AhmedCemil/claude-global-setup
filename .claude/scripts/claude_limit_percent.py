#!/usr/bin/env python3
"""Print the Claude 5-hour rate-limit utilization % to stdout.

Reads credentials (SESSION_KEY, DEVICE_ID, ORG_ID) from a per-account .env
file, so the number always reflects the account Claude Code is CURRENTLY
logged in as. Fully portable — NO absolute paths are hardcoded.

Active account is derived the same way the account switcher does it, with no
dependency on it: the live login (~/.claude.json -> oauthAccount.
organizationUuid) is matched against each stored account's identity.json
(~/.claude/claude_creds/store/<label>/identity.json ->
oauthAccount.organizationUuid). No state file: nothing to write, nothing to
go stale, and it stays correct even after a manual /login.

Env file lookup, first match wins:
    1. $CLAUDE_LIMIT_ENV                            (explicit override)
    2. <env dir>/claude_usage - <active label>.env  (per-account, preferred)
    3. ~/.claude/claude_usage.env                   (legacy single-account)
    4. <script dir>/claude_usage.env                (portable set, pre-install)
    5. <script dir>/../claude_usage.env
where <env dir> is $CLAUDE_ENV_DIR, then ~/.claude/claude_env, then ~/.claude.

If the active label cannot be determined (no store, single-account install),
it falls back to the legacy locations, so a plain one-account setup keeps
working unchanged.

Caches the API response per account in ~/.claude/.limit_cache-<label>.json
for 30 seconds. Keying the cache by account means switching accounts never
serves the previous account's number.

Output:
    Single line, e.g. "42.3" or "42.3 (resets in 1h23m)" with --verbose.
    Exit 0 on success, 1 on any error (with stderr message).
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude"
SCRIPT_DIR = Path(__file__).resolve().parent
CONF_PATH = Path.home() / ".claude.json"
STORE_DIR = CLAUDE_DIR / "claude_creds" / "store"
CACHE_TTL_SECONDS = 30
API_TIMEOUT = 15


def _org_of(path: Path) -> str:
    """oauthAccount.organizationUuid from a .claude.json / identity.json."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return ""
    oauth = data.get("oauthAccount")
    if not isinstance(oauth, dict):
        return ""
    return str(oauth.get("organizationUuid") or "")


def active_label() -> str:
    """Label of the account Claude Code is logged in as right now.

    Same derivation the switcher uses: live organizationUuid matched against
    each stored identity. Returns '' if it cannot be determined, so callers
    fall back to the legacy single-account env locations.
    """
    live_org = _org_of(CONF_PATH)
    if not live_org or not STORE_DIR.is_dir():
        return ""
    try:
        entries = sorted(d for d in STORE_DIR.iterdir() if d.is_dir())
    except OSError:
        return ""
    for entry in entries:
        if _org_of(entry / "identity.json") == live_org:
            return entry.name
    return ""


def env_dirs() -> list[Path]:
    """Where per-account widget env files live, in priority order."""
    dirs: list[Path] = []
    override = os.environ.get("CLAUDE_ENV_DIR")
    if override:
        dirs.append(Path(override))
    dirs.append(CLAUDE_DIR / "claude_env")
    dirs.append(CLAUDE_DIR)
    return dirs


def cache_path(label: str = "") -> Path:
    """Cache keyed per account so a switch never serves a stale number."""
    if label:
        return CLAUDE_DIR / f".limit_cache-{re.sub(r'[^A-Za-z0-9._-]', '_', label)}.json"
    return CLAUDE_DIR / ".limit_cache.json"


def env_candidates(label: str = "") -> list[Path]:
    """Env locations in priority order; the per-account file wins when known."""
    candidates: list[Path] = []
    override = os.environ.get("CLAUDE_LIMIT_ENV")
    if override:
        candidates.append(Path(override))
    if label:
        for d in env_dirs():
            candidates.append(d / f"claude_usage - {label}.env")
    candidates.append(CLAUDE_DIR / "claude_usage.env")
    candidates.append(SCRIPT_DIR / "claude_usage.env")
    candidates.append(SCRIPT_DIR.parent / "claude_usage.env")
    return candidates


def find_env_path(label: str = "") -> Path:
    for path in env_candidates(label):
        if path.exists():
            return path
    searched = "\n  ".join(str(c) for c in env_candidates(label))
    who = f" for active account '{label}'" if label else ""
    raise FileNotFoundError(
        f"usage .env not found{who}. Set $CLAUDE_LIMIT_ENV or place it at "
        "~/.claude/claude_env/'claude_usage - <label>.env'. Searched:\n  "
        + searched
    )


def label_from_env_path(path: Path, fallback: str = "") -> str:
    """Label implied by a 'claude_usage - <label>.env' filename.

    Keeps the reported account honest when $CLAUDE_LIMIT_ENV points at a
    different account's file than the one currently logged in.
    """
    m = re.match(r"^claude_usage\s*-\s*(.+)$", path.stem)
    return m.group(1).strip() if m else fallback


def load_env(label: str = "") -> dict[str, str]:
    env_path = find_env_path(label)
    env: dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def read_cache(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    if time.time() - data.get("cached_at", 0) > CACHE_TTL_SECONDS:
        return None
    return data.get("payload")


def write_cache(path: Path, payload: dict) -> None:
    try:
        path.write_text(
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

    label = active_label()
    try:
        label = label_from_env_path(find_env_path(label), label)
    except FileNotFoundError:
        pass
    cache_file = cache_path(label)

    cached = read_cache(cache_file)
    if cached is not None:
        payload = cached
    else:
        try:
            env = load_env(label)
            payload = fetch_usage(env)
            write_cache(cache_file, payload)
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
        bits = []
        resets_at = five.get("resets_at")
        if resets_at:
            bits.append(format_resets_at(resets_at))
        if label:
            bits.append(f"account: {label}")
        suffix = f" ({' · '.join(bits)})" if bits else ""
        print(f"{pct_value:.1f}{suffix}")
    else:
        print(f"{pct_value:.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
