// Screenshot a page so it can be read back with the Read tool.
//   node shot.js "<url>" <out.png> [--full]
const path = require('path');
const os = require('os');
const D = require(path.join(os.homedir(), '.claude/skills/debug-chrome/lib/driver.js'));

(async () => {
  const url = process.argv[2];
  const out = process.argv[3];
  const fullPage = process.argv.includes('--full');
  if (!url || !out) {
    console.error('Usage: node shot.js "<url>" <out.png> [--full]');
    process.exit(1);
  }

  const browser = await D.connect();
  const page = await D.getPage(browser);

  try {
    await D.goto(page, url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 3500));
    // NOTE: never page.setViewport() on an attached browser — it installs a
    // device-metrics override that survives reloads and strands the window at
    // that size. See the debug-chrome skill.
    await page.screenshot({ path: out, fullPage });
    console.log('saved', out, fullPage ? '(full page)' : '(viewport)');
  } finally {
    await D.cleanup(browser);
    browser.disconnect();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
