// Clone an existing debug profile onto a new port, WITHOUT the cache.
//
//   node new-profile.js 9339 research        new port, name it
//   node new-profile.js 9339 research 9334   clone from port 9334's profile
//
// Why clone rather than start clean: extensions, cookies and logged-in sessions
// come along, so a second research browser is usable immediately instead of
// hitting every login wall again.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { profileDir, listProfiles } = require('../lib/paths.js');

// Caches are re-created by Chrome; copying them wastes minutes and gigabytes.
const SKIP = new Set([
  'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache',
  'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache', 'GraphiteDawnCache',
  'component_crx_cache', 'extensions_crx_cache', 'CacheStorage', 'ScriptCache',
  'Crashpad', 'BrowserMetrics', 'Shared Dictionary',
]);

// Machine-specific lock/state files must not travel to the clone.
const DROP_FILES = [/^Singleton/, /\.lock$/, /^LOCK$/, /^lockfile$/];

function isLive(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/json/version', timeout: 1500 },
      (res) => { res.resume(); resolve(true); }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP.has(entry.name)) continue;
    if (!entry.isDirectory() && DROP_FILES.some((re) => re.test(entry.name))) continue;

    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else {
      // A locked file is not fatal here (the source may be half-open); report and
      // keep going, the clone is still usable.
      try { fs.copyFileSync(from, to); }
      catch (e) { console.log(`  ! skipped ${entry.name}: ${e.code}`); }
    }
  }
}

(async () => {
  const [newPortArg, project, fromPortArg] = process.argv.slice(2);
  const newPort = Number(newPortArg);

  if (!Number.isInteger(newPort) || !project) {
    console.error('Usage: node new-profile.js <new-port> <project> [from-port]');
    process.exit(1);
  }

  const profiles = listProfiles();
  if (profiles.some((p) => p.port === newPort)) {
    console.error(`Port ${newPort} is already allocated to "${profiles.find((p) => p.port === newPort).project}".`);
    process.exit(1);
  }

  const source = fromPortArg
    ? profiles.find((p) => p.port === Number(fromPortArg))
    : profiles[0];
  if (!source) {
    console.error('No source profile to clone from. Create one with launch.js first.');
    process.exit(1);
  }

  // Copying a running profile yields a corrupt clone.
  if (await isLive(source.port)) {
    console.error(`Source port ${source.port} is LIVE — close that Chrome first.`);
    process.exit(1);
  }

  const dest = profileDir(project, newPort);
  if (fs.existsSync(dest)) {
    console.error(`Target already exists: ${dest}`);
    process.exit(1);
  }

  console.log(`Cloning ${source.name} -> ${path.basename(dest)} (cache excluded)`);
  copyTree(source.dir, dest);
  console.log(`READY ${dest}`);
  console.log(`Launch it: node launch.js ${newPort} ${project}`);
})();
