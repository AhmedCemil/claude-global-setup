# context_usage.ps1 - REAL context-window usage for a Claude Code session.
#
# Reads the genuine token count straight from the session's transcript JSONL —
# the same data the harness already writes. NO fork, NO `claude` spawn, no junk
# session, no cwd-resume side effects. ~tens of ms even on multi-MB transcripts.
#
# How: every assistant message records a `usage` block. The context window in use
# at the last turn = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
# of the most recent message that carries cache_read_input_tokens (the live context
# is the cached prefix + new input). Window = 1,000,000.
#
# Usage:
#   context_usage.ps1                 # latest session in the CURRENT project folder
#   context_usage.ps1 <sessionId>     # a specific session id (UUID, .jsonl optional)
#   context_usage.ps1 -Headline       # print just "380k / 1m (38%)" one-liner
#
# Project auto-detection: Claude stores transcripts under
#   ~/.claude/projects/<encoded-cwd>/   where <encoded-cwd> is the current working
#   directory with ':' '\' '/' turned into '-'. Derived from the current directory,
#   so there is NO hardcoded project path.

param(
    [string]$SessionId,
    [switch]$Headline
)

$ContextWindow = 1000000

# --- locate this project's transcript folder from the current directory ---
$projectsRoot = Join-Path $HOME ".claude\projects"
$cwd = (Get-Location).Path
# encode: drive colon + path separators -> '-', matching Claude's scheme (e.g. d:\Dev -> d--Dev)
$proj = $null
# Try the cwd then each parent dir (a session started in d:\Dev is found from
# d:\Dev\pdks-report too). First existing encoded folder wins.
$dir = $cwd
while ($dir) {
    $cand = Join-Path $projectsRoot (($dir -replace '[:\\/]', '-'))
    if (Test-Path $cand) { $proj = $cand; break }
    $parent = Split-Path $dir -Parent
    if ($parent -eq $dir) { break }
    $dir = $parent
}

if (-not $proj) {
    Write-Host "No Claude transcript folder for this directory (or its parents):"
    Write-Host "  $cwd"
    Write-Host "Run this from inside a folder where you've used Claude Code."
    exit 1
}

# --- pick the session ---
if ($SessionId) {
    $id = $SessionId -replace '\.jsonl$', ''
    $f = Get-Item (Join-Path $proj "$id.jsonl") -ErrorAction SilentlyContinue
    if (-not $f) {
        Write-Host "No transcript for session id: $id"
        Write-Host "Available (newest first):"
        Get-ChildItem $proj -Filter *.jsonl -File |
            Sort-Object LastWriteTime -Descending | Select-Object -First 8 |
            ForEach-Object { Write-Host "  $($_.BaseName)   ($($_.LastWriteTime))" }
        exit 1
    }
} else {
    $f = Get-ChildItem $proj -Filter *.jsonl -File |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $f) { Write-Host "No sessions found in $proj"; exit 1 }
    $id = $f.BaseName
}

# --- read the last usage block carrying cache_read (no fork, no claude) ---
# Scan from the END of the file for speed: the most recent assistant turn with a
# cache_read_input_tokens field reflects the current context size. Only parse JSON
# on candidate lines (cheap substring pre-filter first).
$best = $null
$lines = [System.IO.File]::ReadAllLines($f.FullName)
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $l = $lines[$i]
    if ($l.IndexOf('cache_read_input_tokens') -lt 0) { continue }
    try { $o = $l | ConvertFrom-Json } catch { continue }
    $u = $o.message.usage
    if (-not $u) { $u = $o.usage }
    if ($u -and ($u.cache_read_input_tokens -or $u.cache_creation_input_tokens)) {
        $best = $u
        break
    }
}

if (-not $best) {
    if ($Headline) { Write-Host "(no usage data yet)"; exit 0 }
    Write-Host "  Session: $id"
    Write-Host "  No usage block with cache tokens found yet (early session?)."
    exit 0
}

$tok = [double]$best.input_tokens `
     + [double]$best.cache_creation_input_tokens `
     + [double]$best.cache_read_input_tokens
$tok = [int]$tok
$pct = [int][math]::Round(($tok / $ContextWindow) * 100)

# format: "380k / 1m (38%)"  (k = thousands, the window is 1m)
function Format-K([int]$t) {
    if ($t -ge 1000) { return ('{0:N0}k' -f [math]::Round($t / 1000)) }
    return "$t"
}
$line = "{0} / 1m ({1}%)" -f (Format-K $tok), $pct

if ($Headline) { Write-Host $line; exit 0 }

Write-Host ""
Write-Host "  Session: $id"
Write-Host "  Updated: $($f.LastWriteTime)"
Write-Host "  Context: $line"
Write-Host ("           input {0} + cache_create {1} + cache_read {2}" -f `
            [int]$best.input_tokens, [int]$best.cache_creation_input_tokens, [int]$best.cache_read_input_tokens)
