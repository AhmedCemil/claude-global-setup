# Claude Global Setup

A portable, PC-agnostic **Claude Code** configuration — carry it to any Windows machine
and work the same way everywhere. It bundles a global `CLAUDE.md` ruleset, context-saving
subagents, a checkpoint skill, a two-way drawing canvas, and a no-Python desktop widget for
your Claude usage limit.

> **Open [`GUIDE.html`](GUIDE.html) for the full, dark-mode walkthrough.** This README is the
> quick version.

## What's inside

```
claude_global_setup/
├─ GUIDE.html                 # fancy dark-mode guide (start here)
├─ README.md                  # this file
├─ .gitignore                 # keeps credentials & machine state out of git
├─ .claude/                   # merge into ~/.claude on any PC
│  ├─ CLAUDE.md               #   global working rules
│  ├─ CLAUDE - Python.md      #   Python cross-project rules
│  ├─ settings.json           #   theme / effort / model
│  ├─ claude_usage.env.example#   credentials TEMPLATE (no real keys)
│  ├─ agents/                 #   co-explorer, co-tester subagents
│  ├─ skills/                 #   save-session-state checkpoint skill
│  ├─ scripts/                #   claude_limit_percent.py (5h limit %)
│  └─ tools/                  #   shared-canvas.html (visual channel)
└─ usage-widget/              # no-Python desktop usage widget (Win10/11)
   ├─ usage-widget.ps1
   ├─ cuw.vbs · cuw.bat       #   launch hidden, no console flash
   └─ README.md
```

## Install (any PC, no installer, no admin)

1. **Merge the config** into your home dir:
   ```powershell
   Copy-Item .\.claude\* $HOME\.claude\ -Recurse -Force
   ```
2. **Add your credentials** *(optional — only for the usage % features)*:
   ```powershell
   Copy-Item $HOME\.claude\claude_usage.env.example $HOME\.claude\claude_usage.env
   # then fill in SESSION_KEY / DEVICE_ID / ORG_ID
   ```
3. **Launch Claude Code.** `CLAUDE.md` loads automatically; agents, skill, and canvas are global.
4. **(Optional) usage widget:** double-click `usage-widget\cuw.bat`. See its README.

## Design principles

- **Zero hardcoded paths.** Everything resolves from `$HOME` / `~` or a file's own location.
  Grep the tree for a drive letter → nothing real, only documentation placeholders.
- **Public-repo safe.** No names, emails, or secrets. The real `.env` is git-ignored; only
  `claude_usage.env.example` ships. Personalize `CLAUDE.md`'s user line for yourself.
- **No-install where possible.** The usage widget uses only WinForms + `curl.exe` that ship
  with Windows 10/11. The limit script needs Python; the widget does not.
- **Windows 10/11 + PowerShell** is the target. Mac/Linux aren't covered yet.

## Credentials & privacy

The usage features read three values from `~/.claude/claude_usage.env`:
`SESSION_KEY`, `DEVICE_ID`, `ORG_ID` — your personal claude.ai session.

**Never commit the filled-in `.env` or put it in a shared zip.** The `.gitignore` already
blocks it; only the empty `.example` template is tracked. See
[`claude_usage.env.example`](.claude/claude_usage.env.example) for where each value comes from.

## License

Share freely. No warranty — these are personal dotfiles offered as a template.
