// real-input.js — REAL mouse/keyboard + a VISIBLE cursor overlay.
// APP-AGNOSTIC (KATMAN 1). Extracted verbatim from OrgMap's proven
// helpers/real-input.js (verify-real-drag 12/12), minus the two OrgMap-specific
// readers (cardCenter/cardAimPoint know #org-chart g.node) which now live in
// KATMAN 2 (the project journey).
//
// WHY: most puppeteer checks drive the app via page.evaluate() — element.click(),
// dispatchEvent(), or calling app functions directly. That is SYNTHETIC: it
// bypasses the real input pipeline (no hover, no hit-test, no drag-threshold, no
// hold-timer, clicks even hidden elements). It proves the DATA layer but NOT the
// INTERACTION. These helpers drive the page with page.mouse.* / page.keyboard.*
// so the browser does the real thing.
//
// VISIBLE CURSOR: injectCursor() drops one fixed dot (+ hold-ring) into the page.
// Every move/press/release updates it, so a watching human — or a captured GIF —
// SEES the test grab something, drag it, and the ring fill during a ~0.7s hold.
// Cheap: one DOM node, updated on each step we already take (no rAF from us).
//
// evaluate() stays — but ONLY for READING/MEASURING outcomes, never the gesture.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Visible cursor overlay ───────────────────────────────────────────────────
// Inject once per page. Idempotent.
export async function injectCursor(page) {
    await page.evaluate(() => {
        if (window.__riCursor) return;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dot.id = '__ri-cursor';
        dot.setAttribute('width', '28'); dot.setAttribute('height', '28');
        dot.setAttribute('viewBox', '0 0 28 28');
        Object.assign(dot.style, {
            position: 'fixed', left: '0', top: '0', zIndex: '2147483647',
            pointerEvents: 'none', transition: 'transform 70ms ease-out',
            transform: 'translate(-100px,-100px)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))',
        });
        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('cx', '4'); halo.setAttribute('cy', '4'); halo.setAttribute('r', '9');
        halo.setAttribute('fill', 'rgba(124,77,255,0.0)');
        halo.style.transition = 'fill 90ms';
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', 'M1 1 L1 17 L5.5 13 L8.5 19.5 L11 18.4 L8 12 L14 12 Z');
        arrow.setAttribute('fill', '#ffffff');
        arrow.setAttribute('stroke', '#1565c0');
        arrow.setAttribute('stroke-width', '1.3');
        arrow.setAttribute('stroke-linejoin', 'round');
        arrow.style.transition = 'fill 90ms';
        dot.appendChild(halo); dot.appendChild(arrow);

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('width', '40'); ring.setAttribute('height', '40');
        Object.assign(ring.style, {
            position: 'fixed', left: '0', top: '0', marginLeft: '4px', marginTop: '4px',
            zIndex: '2147483646', pointerEvents: 'none', opacity: '0',
            transition: 'opacity 120ms', transform: 'translate(-100px,-100px)',
        });
        const trackC = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        trackC.setAttribute('cx', '20'); trackC.setAttribute('cy', '20'); trackC.setAttribute('r', '16');
        trackC.setAttribute('fill', 'none'); trackC.setAttribute('stroke', 'rgba(124,77,255,0.25)');
        trackC.setAttribute('stroke-width', '2.5');
        const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const CI = 2 * Math.PI * 16;
        circ.setAttribute('cx', '20'); circ.setAttribute('cy', '20'); circ.setAttribute('r', '16');
        circ.setAttribute('fill', 'none'); circ.setAttribute('stroke', '#7c4dff');
        circ.setAttribute('stroke-width', '2.5'); circ.setAttribute('stroke-linecap', 'round');
        circ.setAttribute('transform', 'rotate(-90 20 20)');
        circ.style.strokeDasharray = String(CI);
        circ.style.strokeDashoffset = String(CI);
        ring.appendChild(trackC); ring.appendChild(circ);
        document.body.appendChild(ring);
        document.body.appendChild(dot);

        // Optional caption chip (used by demo/GIF composition). Hidden by default.
        const cap = document.createElement('div');
        cap.id = '__ri-caption';
        Object.assign(cap.style, {
            position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
            zIndex: '2147483645', pointerEvents: 'none', opacity: '0',
            transition: 'opacity 160ms', maxWidth: '80vw',
            padding: '10px 18px', borderRadius: '10px',
            background: 'rgba(20,22,28,0.88)', color: '#fff',
            font: '500 15px/1.3 system-ui,Segoe UI,sans-serif',
            boxShadow: '0 4px 18px rgba(0,0,0,0.4)', textAlign: 'center',
        });
        document.body.appendChild(cap);

        window.__riCursor = {
            C: CI,
            move(x, y) { dot.style.transform = `translate(${x}px,${y}px)`; ring.style.transform = `translate(${x}px,${y}px)`; },
            press() { arrow.setAttribute('fill', '#bbdefb'); halo.setAttribute('fill', 'rgba(124,77,255,0.30)'); },
            release() { arrow.setAttribute('fill', '#ffffff'); halo.setAttribute('fill', 'rgba(124,77,255,0.0)'); this.holdReset(); },
            holdStart() { ring.style.opacity = '1'; circ.style.transition = 'none'; circ.style.strokeDashoffset = String(this.C); },
            holdProgress(p) { circ.style.strokeDashoffset = String(this.C * (1 - Math.max(0, Math.min(1, p)))); },
            holdReset() { ring.style.opacity = '0'; circ.style.strokeDashoffset = String(this.C); },
            caption(text) { if (text) { cap.textContent = text; cap.style.opacity = '1'; } else { cap.style.opacity = '0'; } },
        };
    });
}

async function curMove(page, x, y) { await page.evaluate((x, y) => window.__riCursor && window.__riCursor.move(x, y), x, y); }
async function curPress(page) { await page.evaluate(() => window.__riCursor && window.__riCursor.press()); }
async function curRelease(page) { await page.evaluate(() => window.__riCursor && window.__riCursor.release()); }

// Set (or clear, with no arg) the on-screen caption chip. For demo/GIF frames.
export async function caption(page, text = '') { await page.evaluate((t) => window.__riCursor && window.__riCursor.caption(t), text); }

// ── Real pointer primitives (visible cursor follows) ─────────────────────────
export async function moveTo(page, x, y, steps = 12) {
    await page.mouse.move(x, y, { steps });
    await curMove(page, x, y);
}

export async function press(page, x, y) {
    if (x != null) await moveTo(page, x, y, 6);
    await curPress(page);
    await page.mouse.down();
}

export async function release(page) {
    await page.mouse.up();
    await curRelease(page);
}

// Drag from (x1,y1)→(x2,y2) with real pointer events. `hold` = ms to dwell over
// the target before releasing (~800 arms a hold gesture; ~0 = quick move). When
// holding, the visible ring fills in lockstep.
export async function realDrag(page, x1, y1, x2, y2, { hold = 0, steps = 18 } = {}) {
    await press(page, x1, y1);
    await sleep(60);
    await moveTo(page, x1 + 6, y1 + 6, 3);   // clear drag threshold
    await moveTo(page, x2, y2, steps);
    if (hold > 0) {
        await page.evaluate(() => window.__riCursor && window.__riCursor.holdStart());
        const t0 = Date.now();
        while (Date.now() - t0 < hold) {
            const p = (Date.now() - t0) / hold;
            await page.evaluate((p) => window.__riCursor && window.__riCursor.holdProgress(p), p);
            await page.mouse.move(x2 + ((Date.now() & 2) ? 1 : -1), y2, { steps: 1 }); // keep mousemove alive
            await sleep(40);
        }
        await page.evaluate(() => window.__riCursor && window.__riCursor.holdProgress(1));
        await moveTo(page, x2, y2, 1);
    }
    await sleep(40);
    await release(page);
}

// Real click at a point, cursor visible.
export async function clickAt(page, x, y) {
    await moveTo(page, x, y, 8);
    await curPress(page);
    await page.mouse.down();
    await sleep(30);
    await page.mouse.up();
    await curRelease(page);
}

// Generic on-screen center of the first element matching a CSS selector.
// Returns {x,y,rect} or null. (App-specific readers — chart cards etc. — live
// in KATMAN 2, but this covers ordinary selectors.)
export async function elementCenter(page, selector) {
    return await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0)) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                 rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }, selector);
}
