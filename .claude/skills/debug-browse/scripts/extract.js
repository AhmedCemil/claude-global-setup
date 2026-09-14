// Pull title / price / spec lines off a product or detail page.
//
//   node extract.js "<url>"                 auto-pick a site profile
//   node extract.js "<url>" hepsiburada     force one
//
// Site-specific knowledge (selectors, URL shapes) lives in ../sites/*.json, NOT
// here. When a site changes its HTML you edit that one JSON file. The rules in
// this script are the ones that held true across every site so far.
const fs = require('fs');
const path = require('path');
const os = require('os');
const D = require(path.join(os.homedir(), '.claude/skills/debug-chrome/lib/driver.js'));

const SITES_DIR = path.join(__dirname, '..', 'sites');

function loadSite(url, forced) {
  const files = fs.readdirSync(SITES_DIR).filter((f) => f.endsWith('.json'));
  const profiles = files.map((f) => JSON.parse(fs.readFileSync(path.join(SITES_DIR, f), 'utf8')));
  if (forced) {
    const hit = profiles.find((p) => p.name.toLowerCase() === forced.toLowerCase());
    if (!hit) throw new Error(`No site profile named "${forced}". Have: ${profiles.map((p) => p.name).join(', ')}`);
    return hit;
  }
  return (
    profiles.find((p) => p.match && p.match !== '*' && url.includes(p.match)) ||
    profiles.find((p) => p.match === '*')
  );
}

(async () => {
  const url = process.argv[2];
  const forced = process.argv[3];
  if (!url) {
    console.error('Usage: node extract.js "<url>" [site-profile-name]');
    process.exit(1);
  }

  const site = loadSite(url, forced);
  const browser = await D.connect();
  const page = await D.getPage(browser); // reuse the tab, never newPage()

  try {
    await D.goto(page, url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 3000));

    // A login/bot wall means STOP: leave the window open for the user.
    const gate = await D.needsLogin(page);
    if (gate.marker || gate.hasPassword) {
      console.log('LOGIN_REQUIRED', JSON.stringify(gate));
      browser.disconnect();
      return;
    }

    // Lazy-loaded specs only appear after scrolling — true on every site so far.
    await D.autoScroll(page, { steps: 6, step: 900, pause: 300 });
    await new Promise((r) => setTimeout(r, 1200));

    const data = await page.evaluate((cfg) => {
      const firstMatch = (selectors) => {
        for (const sel of selectors || []) {
          const el = document.querySelector(sel);
          const txt = el && (el.innerText || el.content || '').trim();
          if (txt) return txt;
        }
        return '';
      };

      // Spec keywords, TR + EN. Kept generic on purpose: these travel between sites.
      const SPEC = /\b\d+\s*(cm|mm|m|kg|g|gr|inç|inch|lt|l)\b|boy(?:u|:)|çap|ebat|ölçü|uzunluk|genişlik|derinlik|ağırlık|katlan|kapal[ıi]|weight|width|height|length|dimension/i;

      const attrs = [];
      (cfg.attrSelectors || []).forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
          if (t && t.length < 160 && SPEC.test(t)) attrs.push(t);
        });
      });

      const bodyLines = (document.body.innerText || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && SPEC.test(l));

      return {
        title: firstMatch(cfg.titleSelectors),
        price: firstMatch(cfg.priceSelectors).slice(0, 60),
        attrs: [...new Set(attrs)].slice(0, 25),
        specLines: [...new Set(bodyLines)].slice(0, 30),
      };
    }, site);

    console.log('SITE  :', site.name);
    console.log('URL   :', page.url());
    console.log('TITLE :', data.title);
    console.log('PRICE :', data.price);
    console.log('--- ATTRS ---');
    data.attrs.forEach((a) => console.log(' ', a));
    console.log('--- SPEC LINES ---');
    data.specLines.forEach((l) => console.log(' ', l));
    if (site.notes) console.log('\nNOTE:', site.notes);
    // A model's height in a description is NOT the product's size. Bit us before.
    console.log('WARNING: a person/model height in the copy is not a product dimension.');
  } finally {
    await D.cleanup(browser);
    browser.disconnect(); // disconnect != close; the window stays up
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
