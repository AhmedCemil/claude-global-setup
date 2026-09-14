// Navigate to a page and dump its readable text.
//   node browse.js "<url>" [waitMs]
const path = require('path');
const os = require('os');
const D = require(path.join(os.homedir(), '.claude/skills/debug-chrome/lib/driver.js'));

(async () => {
  const url = process.argv[2];
  const waitMs = parseInt(process.argv[3] || '3000', 10);
  if (!url) {
    console.error('Usage: node browse.js "<url>" [waitMs]');
    process.exit(1);
  }

  const browser = await D.connect();
  const page = await D.getPage(browser);

  try {
    await D.goto(page, url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, waitMs));

    const gate = await D.needsLogin(page);
    if (gate.marker || gate.hasPassword) {
      // Stop here: the window is open and visible, the user signs in themselves
      // and the session persists in this profile for next time.
      console.log('LOGIN_REQUIRED', JSON.stringify(gate));
      browser.disconnect();
      return;
    }

    console.log('=== TITLE:', await page.title());
    console.log('=== URL:', page.url());
    console.log('=== TEXT START ===');
    console.log(await D.readText(page, 8000));
    console.log('=== TEXT END ===');
  } finally {
    await D.cleanup(browser);
    browser.disconnect();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
