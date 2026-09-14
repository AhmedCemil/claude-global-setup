// Shared browser driver for every page this machine reads or scrapes.
//
// Sits on top of paths.js, so it is machine-portable. Both the research flow
// (login walls, persistent sessions) and the site scrapers use THIS driver —
// one connection discipline, one set of lessons, no per-task puppeteer calls.
//
// Two rules here were paid for in real damage; do not route around them.
const { puppeteer } = require('./paths.js');

const PORT = process.env.DEBUG_CHROME_PORT || process.env.CLAUDE_BROWSER_PORT || 9333;

// Attach to an already-running debug Chrome. Never launches one: launching is
// launch.js's job, and an ad-hoc launch would miss the --user-data-dir.
async function connect(port = PORT) {
  return puppeteer().connect({
    browserURL: `http://127.0.0.1:${port}`,
    defaultViewport: null, // keep the real window size
  });
}

// LESSON (2026-08-25): never open a tab per navigation — 13 tabs piled up in the
// user's window. Reuse the first tab and close the rest; navigate the SAME page
// object in a loop instead of calling newPage().
async function getPage(browser) {
  const pages = await browser.pages();
  if (!pages.length) return browser.newPage();
  for (let i = 1; i < pages.length; i++) {
    try { await pages[i].close(); } catch { /* already gone */ }
  }
  return pages[0];
}

// Call when the job is done: drop extra tabs, park the first one.
async function cleanup(browser) {
  const pages = await browser.pages();
  for (let i = 1; i < pages.length; i++) {
    try { await pages[i].close(); } catch { /* already gone */ }
  }
  if (pages[0]) {
    try { await pages[0].goto('about:blank'); } catch { /* navigating away is best-effort */ }
  }
}

async function goto(page, url, opts = {}) {
  await page.goto(url, {
    waitUntil: opts.waitUntil || 'networkidle2',
    timeout: opts.timeout || 45000,
  });
}

// Readable text with the scaffolding stripped out.
async function readText(page, maxChars = 12000) {
  return page.evaluate((max) => {
    const drop = ['script', 'style', 'noscript', 'svg', 'iframe'];
    const clone = document.body.cloneNode(true);
    drop.forEach((sel) => clone.querySelectorAll(sel).forEach((n) => n.remove()));
    return (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
  }, maxChars);
}

async function links(page, limit = 60) {
  return page.evaluate((lim) => {
    const out = [];
    document.querySelectorAll('a[href]').forEach((a) => {
      const text = (a.innerText || '').trim().replace(/\s+/g, ' ');
      if (text && a.href.startsWith('http')) out.push({ text: text.slice(0, 90), href: a.href });
    });
    return out.slice(0, lim);
  }, limit);
}

// Detect a login/bot wall so we can STOP and hand the window to the user.
// We never solve captchas or type credentials — the window is already open and
// visible; the user signs in once and the session persists in the profile.
async function needsLogin(page) {
  return page.evaluate(() => {
    const body = (document.body.innerText || '').toLowerCase();
    const markers = [
      'sign in', 'log in', 'giriş yap', 'oturum aç',
      'verify you are human', 'are you a robot', 'captcha',
      'access denied', 'subscribe to continue', 'abone ol',
    ];
    return {
      hasPassword: !!document.querySelector('input[type="password"]'),
      marker: markers.find((m) => body.includes(m)) || null,
      title: document.title,
    };
  });
}

// Scroll far enough to trigger lazy-loaded content (listings, infinite feeds).
async function autoScroll(page, { steps = 5, step = 1200, pause = 400 } = {}) {
  await page.evaluate(async (s, px, ms) => {
    for (let i = 0; i < s; i++) {
      window.scrollBy(0, px);
      await new Promise((r) => setTimeout(r, ms));
    }
  }, steps, step, pause);
}

// LESSON (2026-08-25): never kill Chrome by process. Filtering processes by the
// profile path DOES NOT WORK — renderer/GPU children don't carry it, and killing
// the parent took down the user's own 14-tab Chrome. Close over CDP, which only
// ever reaches the instance holding this debug port. Normally don't close at
// all: disconnect() and leave the window up.
async function closeBrowser(browser) {
  await browser.close();
}

module.exports = {
  connect, getPage, cleanup, goto, readText, links,
  needsLogin, autoScroll, closeBrowser, PORT,
};
