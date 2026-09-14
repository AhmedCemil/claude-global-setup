# Claude Global Setup

A portable, PC-agnostic **Claude Code** configuration — carry it to any Windows machine
and work the same way everywhere. It bundles a global `CLAUDE.md` ruleset, context-saving
subagents, checkpoint and context-reading skills, a multi-instance debug-Chrome system with
a shared browser driver, a two-way drawing canvas, and a no-Python desktop widget for your
Claude usage limit.

> **Open [`GUIDE.html`](GUIDE.html) for the full, dark-mode walkthrough.** This README is the
> quick version.

## What's inside

```
claude_global_setup/
├─ GUIDE.html                  # fancy dark-mode guide (start here)
├─ README.md                   # this file
├─ .gitignore                  # keeps credentials & machine state out of git
├─ .claude/                    # merge into ~/.claude on any PC
│  ├─ CLAUDE.md                #   global working rules
│  ├─ CLAUDE - Python.md       #   Python cross-project rules
│  ├─ settings.json            #   theme / effort / model
│  ├─ machines.json.example    #   per-machine paths TEMPLATE (no real hostnames)
│  ├─ claude_usage.env.example #   credentials TEMPLATE (no real keys)
│  ├─ agents/                  #   co-explorer, co-tester subagents
│  ├─ skills/
│  │  ├─ debug-chrome/         #     ports, profiles, launcher + shared browser driver
│  │  ├─ debug-browse/         #     page reading & site-profile extraction
│  │  ├─ context-usage/        #     real context-window usage, no side effects
│  │  ├─ save-session-state/   #     checkpoint: 5h limit % + context %
│  │  └─ hardening-ui-tests/   #     making browser/e2e tests actually trustworthy
│  ├─ scripts/
│  │  ├─ machine.js            #     which machine am I -> per-machine values
│  │  ├─ context_usage.ps1     #     reads real token counts from the transcript
│  │  └─ claude_limit_percent.py #   5h rate-limit %
│  └─ tools/
│     ├─ shared-canvas.html    #     two-way visual channel with Claude
│     ├─ browser-test-kit/     #     app-agnostic browser test engine
│     └─ transkript/           #     local audio/video -> text (Whisper)
└─ usage-widget/               # no-Python desktop usage widget (Win10/11)
   ├─ usage-widget.ps1
   ├─ cuw.vbs / cuw.bat        #   launch hidden, no console flash
   └─ README.md
```

## Install (any PC, no installer, no admin)

1. **Merge the config** into your home dir:
   ```powershell
   Copy-Item .\.claude\* $HOME\.claude\ -Recurse -Force
   ```
2. **Tell it about this machine** *(needed once per PC)*:
   ```powershell
   Copy-Item $HOME\.claude\machines.json.example $HOME\.claude\machines.json
   node -e "console.log(require('os').hostname())"   # put this in the file
   node $HOME\.claude\scripts\machine.js             # verify it resolves
   ```
3. **Add your credentials** *(optional — only for the usage % features)*:
   ```powershell
   mkdir $HOME\.claude\claude_env -Force
   Copy-Item $HOME\.claude\claude_usage.env.example "$HOME\.claude\claude_env\claude_usage - <label>.env"
   # then fill in SESSION_KEY / DEVICE_ID / ORG_ID
   ```
4. **Launch Claude Code.** `CLAUDE.md` loads automatically; agents, skills, and canvas are global.
5. **(Optional) usage widget:** double-click `usage-widget\cuw.bat`. See its README.

## Design principles

- **Zero hardcoded paths.** Everything resolves from `$HOME` / `~`, a file's own location, or
  `machines.json`. Grep the tree for a drive letter → nothing real, only documentation placeholders.
- **Machine-agnostic, not machine-blind.** Values that genuinely differ per PC (profile roots,
  dev roots) live in one `machines.json`, keyed by hostname — like a translations file keyed by
  locale. Adding a machine is one new group; no script changes.
- **Public-repo safe.** No names, emails, hostnames, or secrets. The real `machines.json` and
  `.env` are git-ignored; only the `.example` templates ship.
- **No-install where possible.** The usage widget uses only WinForms + `curl.exe` that ship with
  Windows 10/11. The limit script needs Python; the widget does not. `context_usage.ps1` reads the
  transcript directly — no spawning, no side effects.
- **Windows 10/11 + PowerShell** is the target. Mac/Linux aren't covered yet.

## Browser work

`debug-chrome` runs several Chrome instances side by side — one port + its own profile each — so
parallel sessions never fight over tabs, and your everyday Chrome is never touched. `debug-browse`
sits on its driver for page reading and extraction, keeping site-specific selectors in
`sites/*.json` so a redesign is a one-file fix.

```powershell
node $HOME\.claude\skills\debug-chrome\scripts\status.js        # what's allocated / live
node $HOME\.claude\skills\debug-chrome\scripts\launch.js 9333 general
node $HOME\.claude\skills\debug-browse\scripts\browse.js "https://example.com"
```

Ports and profile roots are per-machine and deliberately **not** synced — the folder names are
the registry.

## Credentials & privacy

The usage features read three values from your per-account env file:
`SESSION_KEY`, `DEVICE_ID`, `ORG_ID` — your personal claude.ai session. `.gitignore` blocks the
real file; only the empty `.example` template is tracked. See
[`claude_usage.env.example`](.claude/claude_usage.env.example) for where each value comes from.

Likewise `machines.json` holds your hostnames and folder layout, so it stays local — see
[`machines.json.example`](.claude/machines.json.example).

## License

Share freely. No warranty — these are personal dotfiles offered as a template.
