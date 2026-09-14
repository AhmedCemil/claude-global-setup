# browser-test-kit (KATMAN 1 — global, app-agnostic)

The reusable engine under every browser-app test on this machine. Lives here
(like `shared-canvas.html` and the `debug-chrome` skill) so it is shared across
**all projects and all PCs**, not copied per project.

**Two-tier architecture** (decided with the user, 2026-07-28):

- **KATMAN 1 — this dir.** Knows nothing about any app's DOM. Connect-by-port,
  real `page.mouse.*` drag + hit-test, a visible cursor + hold-ring, captions,
  screenshots, SS→GIF stitching, and a pass/fail asserter.
- **KATMAN 2 — the project.** e.g. OrgMap's `test/puppeteer/helpers/journey.js`.
  Imports this kit and adds DOM-specific steps (`login`, `openFirm`, `editPerson`,
  `dragSwap`, chart selectors). Useless in another project → stays local.

A test file is then a thin composition: journey steps + asserts. The **same**
step definitions serve three masters — the per-feature test, the pre-ship
"test everything" gate, and the demo/help GIF (steps written caption/SS-aware).

## puppeteer is injected, not imported

`puppeteer-core` installs per-project; it does not resolve from `~/.claude`. So
the caller passes its own instance:

```js
import puppeteer from 'puppeteer-core';
import { connectByPort } from 'file:///C:/Users/<you>/.claude/tools/browser-test-kit/connect.js';
const { browser, page } = await connectByPort(puppeteer, 9334, { baseUrl: 'http://localhost:8082' });
```

## Modules

| file | exports | notes |
|---|---|---|
| `connect.js` | `connectByPort(puppeteer, port, {baseUrl})`, `launch(puppeteer, {...})`, `wireConsole`, `getWindowBounds`, `setWindowBounds`, `restoreWindowBounds`, `withWindowSize` | attach to debug Chrome by port (the dominant style), or launch fresh. Window helpers: see "Resizing" below |
| `real-input.js` | `injectCursor`, `realDrag`, `moveTo`, `press`, `release`, `clickAt`, `caption`, `elementCenter`, `sleep` | REAL pointer events + visible cursor/hold-ring. `evaluate()` is for reading only |
| `capture.js` | `Recorder` (snap/toGif/clean), `shot`, `hasFfmpeg` | GIF stitch via ffmpeg (PATH or `FFMPEG` env); fails soft to a PNG strip |
| `assert.js` | `makeChecks` (flat ok/done), `makeRunner` (named steps), `expect`, `eq`, `log`, `sleep` | both proven OrgMap styles |
| `index.js` | re-exports all of the above | one import surface |

## Resizing the window — always give it back

A test that resizes a **shared, visible** debug Chrome and doesn't restore it
leaves the browser at the test's size. Afterwards the app renders into a small
box in the corner of the window, survives reloads, and looks exactly like an app
layout bug — the user "fixes" it by toggling DevTools (which just forces a
resize event). This burned a real debugging detour on OrgMap (2026-07-29).

1. **Prefer a headless instance** for anything that resizes (OrgMap: 9336, not the
   visible 9334).
2. If you must use the visible one, wrap the run.
3. **Restore in `finally`** — a failing test must not keep the user's window.

```js
// scoped: restores automatically, even if fn throws
await withWindowSize(page, { width: 1280, height: 800 }, async () => {
    await checkLayout();
});

// or manually, around a whole run
const original = await getWindowBounds(page);
try { /* ...resize + assert... */ }
finally { await restoreWindowBounds(page, original); }
```

`restoreWindowBounds` also clears any `Emulation.clearDeviceMetricsOverride`,
which otherwise outlives the window resize and pins the page viewport.

## GIF

`Recorder` snaps numbered PNGs then stitches with ffmpeg's two-pass palette
recipe. No npm dependency. If ffmpeg is missing it leaves the frames and prints
how to enable stitching — a demo degrades, a test never crashes.

```js
import { Recorder } from '.../capture.js';
const rec = new Recorder(page, 'd:/Dev/orgmap/review/gif/enroll');
await rec.snap('login'); /* ...steps... */ await rec.snap('done', 3);
await rec.toGif({ fps: 2, width: 1280 });
```
