// assert.js — minimal expect + colored pass/fail counter + step runner.
// APP-AGNOSTIC (KATMAN 1). Knows nothing about any specific app's DOM.
//
// Two usage styles, both extracted from OrgMap's working tests:
//   1. Flat counter (verify-3way-merge.mjs style): const t = makeChecks();
//      t.ok(cond, 'msg', 'detail'); ... t.done() → sets process.exitCode.
//   2. Step runner (scenarios/assert.js style): const r = makeRunner('name');
//      await r.step('does X', async () => { ... }); r.summary();
//
// Colors are ANSI; harmless when piped to a file.

const C = { grn: '\x1b[32m', red: '\x1b[31m', cyn: '\x1b[36m', dim: '\x1b[2m', rst: '\x1b[0m' };

export function expect(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
}

export function eq(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || 'eq'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export const log = {
    info: (m) => console.log(`  ${C.dim}· ${m}${C.rst}`),
    pass: (m) => console.log(`  ${C.grn}✓ ${m}${C.rst}`),
    fail: (m) => console.log(`  ${C.red}✕ ${m}${C.rst}`),
    step: (i, m) => console.log(`${C.cyn}[${i}]${C.rst} ${m}`),
    head: (m) => console.log(`${C.cyn}${m}${C.rst}`),
};

// ── Flat check counter (prove-false-first friendly) ──────────────────────────
// Each ok() is one assertion; done() prints the tally and sets exitCode.
export function makeChecks() {
    let pass = 0, fail = 0;
    function ok(cond, msg, detail = '') {
        if (cond) { pass++; console.log(`  ${C.grn}✓${C.rst} ${msg}`); }
        else { fail++; console.log(`  ${C.red}✗${C.rst} ${msg} ${C.dim}${detail}${C.rst}`); }
        return !!cond;
    }
    function done() {
        console.log(`\n  ${fail === 0 ? C.grn : C.red}${pass}/${pass + fail} check PASS${C.rst}`);
        process.exitCode = fail === 0 ? 0 : 1;
        return { pass, fail };
    }
    return { ok, done, get pass() { return pass; }, get fail() { return fail; } };
}

// ── Step runner (named steps, throw-on-fail) ─────────────────────────────────
export function makeRunner(scenarioName) {
    let stepIdx = 0;
    const results = [];
    async function step(name, fn) {
        stepIdx++;
        log.step(stepIdx, name);
        const t0 = Date.now();
        try {
            await fn();
            const ms = Date.now() - t0;
            log.pass(`(${ms} ms)`);
            results.push({ name, ok: true, ms });
        } catch (err) {
            const ms = Date.now() - t0;
            log.fail(`${err.message} (${ms} ms)`);
            results.push({ name, ok: false, ms, error: err.message });
            throw err;
        }
    }
    function summary() {
        const ok = results.filter((r) => r.ok).length;
        const total = results.length;
        const status = ok === total ? `${C.grn}PASS${C.rst}` : `${C.red}FAIL${C.rst}`;
        console.log(`\n${status} ${scenarioName} — ${ok}/${total} step`);
        return { name: scenarioName, ok, total, results };
    }
    return { step, summary };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { C as COLORS };
