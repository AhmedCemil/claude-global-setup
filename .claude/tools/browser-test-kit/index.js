// browser-test-kit — GLOBAL, app-agnostic browser-test engine (KATMAN 1).
//
// One import surface for the whole kit. A project's local journey (KATMAN 2)
// imports from here and adds its own DOM-specific steps.
//
//   import * as kit from 'file:///C:/Users/<you>/.claude/tools/browser-test-kit/index.js';
// or the pieces:
//   import { connectByPort } from '.../connect.js';
//   import { realDrag, injectCursor, caption } from '.../real-input.js';
//   import { Recorder, shot } from '.../capture.js';
//   import { makeChecks, makeRunner, expect, eq, log, sleep } from '.../assert.js';
//
// puppeteer is INJECTED (connectByPort(puppeteer, ...)) — the kit never imports
// puppeteer-core, so it works from any project regardless of where that module
// is installed.

// NOTE: `sleep` is defined in BOTH real-input.js and assert.js (each needs it
// internally). A bare `export *` from both makes the name ambiguous → undefined.
// So we re-export sleep explicitly from one place and star the rest.
export { sleep } from './assert.js';
export * from './connect.js';
export * from './real-input.js';
export * from './capture.js';
export {
    expect, eq, log, makeChecks, makeRunner, COLORS,
} from './assert.js';
