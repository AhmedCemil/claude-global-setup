// Cache cleanup for debug Chrome profiles.
//   node clean.js          all idle profiles (live ones are SKIPPED)
//   node clean.js 9334     one port
//   node clean.js --dry    report only, delete nothing
//
// SAFETY: a profile whose port is listening is never touched — deleting from a
// running profile corrupts it. Settings, cookies and logins are never deleted:
// the user's Chrome language lives in Preferences (losing it brings back the
// translate popup) and logins live in Cookies/Login Data.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { profilesRoot, listProfiles } = require('../lib/paths.js');

// Chrome rebuilds all of these on its own.
const CACHE_DIRS = [
  'Default/Cache',
  'Default/Code Cache',
  'Default/GPUCache',
  'Default/Service Worker/CacheStorage',
  'Default/Service Worker/ScriptCache',
  'Default/Application Cache',
  'Default/DawnCache',
  'Default/DawnGraphiteCache',
  'Default/DawnWebGPUCache',
  'Default/Shared Dictionary',
  'Default/optimization_guide_model_and_features_store',
  'GrShaderCache',
  'ShaderCache',
  'GraphiteDawnCache',
  'GPUPersistentCache',
  'Crashpad',
  'component_crx_cache',
  'extensions_crx_cache',
];

// Documentation of intent — the code above simply never lists these.
const NEVER_TOUCH = [
  'Default/Preferences', 'Default/Secure Preferences', 'Default/Cookies',
  'Default/Login Data', 'Default/Local Storage', 'Default/IndexedDB', 'Local State',
];

function isLive(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/json/version', timeout: 1200 },
      (res) => { res.resume(); resolve(true); }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else { try { total += fs.statSync(full).size; } catch { /* locked */ } }
    }
  };
  walk(dir);
  return total;
}

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const portArg = args.find((a) => /^\d+$/.test(a));

  const profiles = listProfiles();
  if (!profiles.length) {
    console.log('No profiles to clean under', profilesRoot());
    return;
  }

  let grandTotal = 0;
  for (const profile of profiles) {
    if (portArg && String(profile.port) !== portArg) continue;

    if (await isLive(profile.port)) {
      console.log(`SKIP  ${profile.name} — port ${profile.port} is LIVE (close that Chrome first)`);
      continue;
    }

    let freed = 0;
    for (const rel of CACHE_DIRS) {
      const full = path.join(profile.dir, ...rel.split('/'));
      if (!fs.existsSync(full)) continue;
      const size = dirSize(full);
      if (!dry) {
        // A locked file here means something still holds the profile: report it
        // rather than forcing, and move on.
        try { fs.rmSync(full, { recursive: true, force: true }); }
        catch (e) { console.log(`  ! could not remove ${rel}: ${e.code}`); continue; }
      }
      freed += size;
    }
    grandTotal += freed;
    console.log(`${dry ? 'DRY ' : 'OK  '}  ${profile.name} — ${mb(freed)} ${dry ? 'removable' : 'freed'}`);
  }

  console.log('');
  console.log(`Total: ${mb(grandTotal)} ${dry ? '(dry run, nothing deleted)' : 'freed'}`);
  console.log('Kept:', NEVER_TOUCH.join(', '));
})();
