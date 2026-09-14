// connect.js — attach to an already-running debug Chrome by port.
// APP-AGNOSTIC (KATMAN 1).
//
// WHY puppeteer is INJECTED, not imported here: puppeteer-core is installed
// per-project (e.g. test/puppeteer/node_modules), and this global kit lives at
// ~/.claude/tools where that module does NOT resolve. So the caller passes its
// own puppeteer instance. This keeps the kit dependency-free and reusable on
// every PC/project regardless of where puppeteer-core is installed.
//
// Pattern extracted from the ~29 OrgMap tools that connect via browserURL
// (verify-3way-merge.mjs, verify-autoload.js, stress-scenarios.js, ...).
//
//   import puppeteer from 'puppeteer-core';
//   import { connectByPort } from '<kit>/connect.js';
//   const { browser, page } = await connectByPort(puppeteer, 9334, { baseUrl });

// Connect to a debug Chrome on 127.0.0.1:<port>, return { browser, page }.
// Finds an existing tab whose URL starts with baseUrl; else opens a new tab.
// Auto-accepts native dialogs (confirm/alert) so a stray confirm() can't hang
// a headless run — the app uses showConfirm()/showToast for real UX, native
// dialogs here are always test-incidental.
export async function connectByPort(puppeteer, port, { baseUrl = null, protocolTimeout = 25000, autoDialog = true } = {}) {
    const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${port}`,
        defaultViewport: null,
        protocolTimeout,
    });
    let page = null;
    if (baseUrl) {
        const pages = await browser.pages();
        page = pages.find((p) => p.url().startsWith(baseUrl)) || null;
    }
    if (!page) page = await browser.newPage();
    if (autoDialog) page.on('dialog', async (d) => { try { await d.accept(); } catch {} });
    wireConsole(page);
    return { browser, page };
}

// Launch a fresh Chrome (the older launchBrowser style). Kept for tests that
// want an isolated browser rather than attaching to the shared debug instance.
export async function launch(puppeteer, { chromePath, headless = false, slowMo = 0, viewport } = {}) {
    const browser = await puppeteer.launch({
        executablePath: chromePath || defaultChromePath(),
        headless,
        slowMo,
        defaultViewport: viewport || (headless ? { width: 1920, height: 1080 } : null),
        args: headless ? ['--window-size=1920,1080'] : ['--start-maximized'],
    });
    const page = await browser.newPage();
    wireConsole(page);
    return { browser, page };
}

// ── Window bounds: borrow, then give back ───────────────────────────────────
//
// Any test that resizes the browser MUST restore it. When a test attaches to a
// shared, VISIBLE debug Chrome (the one the user is actually looking at) and
// leaves it at the test's dimensions, the app afterwards renders into a small
// box in a corner of the window. It looks exactly like an app layout bug, and
// it survives reloads — the user "fixes" it by toggling DevTools, which just
// forces a resize event. Cost us a real debugging detour on OrgMap 2026-07-29.
//
// Rules of thumb:
//   1. Prefer running resize tests against a HEADLESS instance.
//   2. If you must use the visible one, wrap the run with these two helpers.
//   3. Restore in a `finally` — a failing test must not keep the user's window.
export async function getWindowBounds(page) {
    const client = await page.createCDPSession();
    try {
        const { windowId } = await client.send('Browser.getWindowForTarget');
        const { bounds } = await client.send('Browser.getWindowBounds', { windowId });
        return bounds;
    } catch {
        return null; // headless/older Chrome: nothing to restore
    } finally {
        await client.detach().catch(() => {});
    }
}

export async function setWindowBounds(page, { width, height, left = 0, top = 0 }) {
    const client = await page.createCDPSession();
    try {
        const { windowId } = await client.send('Browser.getWindowForTarget');
        // A maximized/fullscreen window ignores width/height — normalize first.
        await client.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
        await client.send('Browser.setWindowBounds', { windowId, bounds: { width, height, left, top } });
    } finally {
        await client.detach().catch(() => {});
    }
}

// Restore bounds captured by getWindowBounds(). Also drops any device-metrics
// emulation override, which would otherwise outlive the window resize and keep
// the page rendering at the test's viewport.
export async function restoreWindowBounds(page, bounds) {
    if (!bounds) return;
    const client = await page.createCDPSession();
    try {
        const { windowId } = await client.send('Browser.getWindowForTarget');
        await client.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
        await client.send('Browser.setWindowBounds', {
            windowId,
            bounds: { width: bounds.width, height: bounds.height, left: bounds.left, top: bounds.top },
        });
        await client.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    } catch {
        /* best effort — never fail a run because restore didn't take */
    } finally {
        await client.detach().catch(() => {});
    }
}

// Run `fn` with the window at a given size, then always put it back.
// Usage: await withWindowSize(page, {width:1280,height:800}, async () => {...})
export async function withWindowSize(page, size, fn) {
    const original = await getWindowBounds(page);
    try {
        await setWindowBounds(page, size);
        return await fn();
    } finally {
        await restoreWindowBounds(page, original);
    }
}

// Surface page console.error / pageerror — catches errors a DOM assert misses.
export function wireConsole(page) {
    page.on('console', (msg) => {
        if (msg.type() === 'error') console.log(`  \x1b[2m[console.error]\x1b[0m ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
        console.log(`  \x1b[31m[page.error]\x1b[0m ${err.message}`);
    });
}

export function defaultChromePath() {
    return process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}
