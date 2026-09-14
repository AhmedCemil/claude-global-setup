---
name: hardening-ui-tests
description: Makes browser/UI automated tests trustworthy so a passing check actually proves the experience works, not just that the DOM layer responded. Use when writing, reviewing, or debugging Puppeteer/Playwright/Selenium/Cypress or any browser e2e test; when a test passes but the UI is visibly broken; when a selector-based assertion needs to be trusted; when deciding headless vs visible or running unattended/overnight or under screen-lock. Core discipline: prove a pass-signal can return false in the negative case (existence != visibility != state).
---

# Hardening UI tests

Hard-won across a multi-round OrgMap/local_ai investigation where **six separate "green"
results were all false** — every one from a selector matching *existence* rather than the
*state* it claimed. This skill encodes the discipline that catches them. Evidence archive:
`d:/Dev/_sandbox/lock-probe/FINDINGS.md`.

## Rule #0 — prove the negative first (non-negotiable)

**Before trusting any pass-signal, prove it returns `false` in the state where the thing is
NOT true.** A signal that can't fail isn't a test — it's decoration.

Every step gets two measurements:
- **Positive:** in the should-pass state → must read `true`.
- **Negative:** in the should-fail state → must read `false`.

If the negative case still reads `true`/non-empty, the selector is matching existence, not
state. Rewrite it. Record both readings so the falsifiability is visible in the output, not
assumed.

## existence ≠ visibility ≠ state

`querySelector('X')` proves an element is in the DOM. It says nothing about whether it is
visible, active, or open. The concrete corrections:

| Wrong (existence) | Right (state) |
|---|---|
| `el = querySelector(...)` → "it's open" | `el.hidden === false && el.offsetParent !== null && el.innerHTML.length > N` |
| `querySelector(':not(.hidden)')` | If the app toggles the **`hidden` attribute** (or inline style), a `.hidden` *class* never exists → the selector is **always true**. Read the actual mechanism (`el.hidden`, computed style). |
| `waitForSelector('#x')` resolved → "visible" | `el.offsetParent !== null && el.getBoundingClientRect().width > 0` (elements persist in the DOM at `0×0`). |
| `body.innerText.includes(t)` | Text may sit in an **input `value`** (not in `innerText`) or in the message *you* sent, not the response. Target the specific container; exclude your own input. |
| clicked at computed x,y | Confirm the point is inside the target's rect **and** `elementFromPoint(x,y).closest('<container>')` is the intended container — not an overlay or sibling panel. |

## Things the DOM cannot tell you → look with your eyes

- **Animations** driven by `requestAnimationFrame` or `stroke-dasharray` (progress rings,
  transitions) change no bounding box and no class — a DOM diff sees nothing. **Screenshot and
  actually view it.** A large PNG byte-count proves bytes exist, not that anything rendered.
- A green data-assert proves the data layer only. The experience can be broken while every
  assert passes (an overlay detaching when a chart pans/zooms is the classic trap).

## Separate the browser from the OS

When a metric looks off (frame rate, latency, timers), you cannot tell *what* degraded from a
browser test alone. Measure the same thing **without a browser** to isolate the layer:
- OS-level timer drift: plain `setInterval` in Node, no page.
- Server health: `curl`/HTTP poll independent of the browser.
- Process cost: sample memory/handles from the OS (e.g. PowerShell `Get-Process`).
- Power/idle policy that can kill a run: `powercfg` (sleep/hibernate/away).

This is how "the frame-rate dropped" gets attributed correctly to the compositor vs the OS
vs the app, instead of guessed.

## Environment discipline

- **Fresh, unique `--user-data-dir` per launched run.** A shared profile leaks login/session
  state between runs and produces failures that look environmental but aren't.
- A **connected** browser (attach to a running instance) has a **persistent profile** — session
  carries across runs; check "is login actually needed" by visibility, don't assume.
- **Native `prompt()`/`confirm()`/`alert()` block the renderer** → the next input call times
  out (`dispatchMouseEvent timed out`). Always register a dialog handler before interacting.
- **Coordinate/layout state (zoom, fit-scale) varies by data and by session** — measure it at
  action time; never hardcode a scale/offset observed once.
- Lists/trees can extend past the viewport → `scrollIntoView({block:'center'})` before clicking.
- Confirm dialogs often carry **no framework class** → find them by text, and click the button
  *inside* the dialog, not a same-named toolbar button.

## Proving a real write persisted

For any mutation test, the pass-signal is not "the click happened" — it's **reload and confirm
the change survived**. Use a unique stamp (e.g. `QA<timestamp>`) as the created value, then
after reload assert that stamp is present. Only mutate data that is safe to mutate (a
dedicated test group/fixture, never production records).

## Decisions that already hold (durable, evidence in FINDINGS.md)

For Puppeteer-driven desktop apps on Windows:
- **Headless launch is the default for unattended/long runs** — deterministic, lighter, fewer
  side effects. Not out of lock-fear.
- **Screen lock does not break tests.** Frame rate dips ~10% under lock and recovers instantly
  on unlock; server, timers, disk, memory all stay healthy. Verified to 90+ min, concurrency,
  and remote-desktop sessions.
- **Attaching to a real desktop window also survives lock** — the launch-mode result transfers.
- **Overnight runs require the machine plugged in** — on AC it never sleeps; on battery it
  sleeps (killing the run) regardless of anything the test does. This is the only real
  interruption risk, and it's not a browser issue.

## Applying this

Project-specific selectors, URLs, and flows live with each project (its test dir / CLAUDE.md),
**not here**. This skill is the portable discipline. When you write a new UI test: apply Rule #0
to every pass-signal, generalize any app quirk you hit into the patterns above, and if a claim
is visual, look at the screenshot before asserting it works.
