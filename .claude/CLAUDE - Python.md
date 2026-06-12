# Python — Cross-project rules

Read this on top of `~/.claude/CLAUDE.md` when the current project is Python. Project-local `CLAUDE.md` (when present) wins on stack-specific details — these are the conventions that apply across every Python project.

---

## Environment & deployment

- **Per-project `requirements.txt` is required** — Nuitka uses it to filter what to bundle. (Whichever venv the project uses, the deps list still travels with the project.)
- **Nuitka deployment**: every project is designed to ship as a single executable. Imports must be Nuitka-friendly:
  - Direct imports: `from src.module import function`
  - Shared-library imports use `sys.path` only when needed:
    ```python
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    ```

---

## Terminal output (Windows console + Unicode)

Windows console mangles Unicode under default code pages. When a script prints Turkish characters or emoji, route output through a unicode converter (or set the console to UTF-8) so it doesn't show as `?` or `\u...` escapes. Pattern:

```bash
python script.py 2>&1 | python <path-to>/unicode_converter.py --stdin
```

If the project ships its own `unicode_converter.py`, use that one. Without this step Turkish characters degrade in the Windows console.

---

## Project structure standard

```
project_name/
├── src/
│   ├── ui/         # All UI tabs/widgets, one class per tab
│   ├── core/       # Business logic, no UI imports
│   └── config/     # Settings, constants, theme
├── main.py         # Coordinator only — does NOT implement features
├── requirements.txt
└── (project-local CLAUDE.md, README, etc.)
```

- **`main.py` coordinates, doesn't implement.** If `main.py` grows past coordinator duties, split.
- **Tab modules**: each UI tab is its own class under `src/ui/`. Tabs do not import each other directly — they go through a controller or shared state.
- **Core never imports UI.** UI imports core. One-way only.
- **Self-contained**: everything the project needs lives inside the project folder. No "shared modules" buried elsewhere unless explicitly intentional.

---

## UI conventions

- **CustomTkinter only.** Do not mix in raw tkinter widgets or PyQt6. If CustomTkinter doesn't have a widget you need, build it on top of `customtkinter.CTkFrame`.
- **Material Design 3 palette** for colors. Light + dark themes both supplied. Single `theme.py` per project owns all color/font tokens — no inline color literals in widgets.
- **Compact density** — reduced padding, ≥14px font sizes for readability. The user has called this out specifically.
- **Auto-navigation + progress feedback** — when a user finishes a step, advance them; when an action is in flight, show it.
- **Theme manager is copy-paste ready** — it should be lift-and-shift into a new project with no edits beyond color values.

---

## Function size guidance

- Handlers / event callbacks: ~150 lines max.
- Manager classes: ~120 lines per method, smaller for plain methods.
- Helper / utility functions: 20–30 lines.

These aren't hard ceilings — they're early-warning lines. If you cross them, ask whether a split helps readability.
