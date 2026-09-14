// List links from a listing / search-results page.
//   node links.js "<url>" [site-profile-name]
//
// With a site profile that defines productUrlPattern, output is narrowed to
// product links; otherwise every on-page link is returned.
const fs = require('fs');
const path = require('path');
const os = require('os');
const D = require(path.join(os.homedir(), '.claude/skills/debug-chrome/lib/driver.js'));

const SITES_DIR = path.join(__dirname, '..', 'sites');

function loadSite(url, forced) {
  const profiles = fs
    .readdirSync(SITES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(SITES_DIR, f), 'utf8')));
  if (forced) return profiles.find((p) => p.name.toLowerCase() === forced.toLowerCase());
  return profiles.find((p) => p.match && p.match !== '*' && url.includes(p.match)) || null;
}

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node links.js "<url>" [site-profile-name]');
    process.exit(1);
  }
  const site = loadSite(url, process.argv[3]);

  const browser = await D.connect();
  const page = await D.getPage(browser);

  try {
    await D.goto(page, url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 3000));

    const gate = await D.needsLogin(page);
    if (gate.marker || gate.hasPassword) {
      console.log('LOGIN_REQUIRED', JSON.stringify(gate));
      browser.disconnect();
      return;
    }

    // Listings lazy-load; without this the tail of the page is empty.
    await D.autoScroll(page, { steps: 5, step: 1200, pause: 400 });

    const pattern = site && site.productUrlPattern;
    const all = await D.links(page, 400);
    const seen = new Set();
    const rows = [];
    for (const { text, href } of all) {
      const clean = href.split('?')[0];
      if (pattern && !clean.includes(pattern)) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      rows.push({ text: text.slice(0, 120), href: clean });
      if (rows.length >= 30) break;
    }

    console.log(`SITE: ${site ? site.name : '(generic)'}  MATCHED: ${rows.length}`);
    rows.forEach((r, i) => console.log(`${i + 1}\t${r.href}\t${r.text}`));
    if (pattern && !rows.length) {
      console.log(`No link matched "${pattern}" — the site may have changed its URL shape.`);
    }
  } finally {
    await D.cleanup(browser);
    browser.disconnect();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
