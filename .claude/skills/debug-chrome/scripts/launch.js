// Start a debug Chrome instance (visible by default) on its own profile.
//
//   node launch.js 9334 orgmap     explicit port + project
//   node launch.js 9334            port; project read from the existing folder
//   node launch.js                 port 9333, project "general"
//   node launch.js 9336 orgmap --headless
//
// Already running on that port -> reports and exits, never double-launches.
// The user's everyday Chrome is untouched: we always pass --user-data-dir.
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { profilesRoot, profileDir, listProfiles, chromeExe } = require('../lib/paths.js');
const { trimProfile } = require('./clean.js');

const TRIM_ABOVE_BYTES = 200 * 1048576;

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

(async () => {
  const args = process.argv.slice(2);
  const headless = args.includes('--headless');
  const positional = args.filter((a) => !a.startsWith('--'));
  const port = Number(positional[0] || 9333);
  if (!Number.isInteger(port) || port < 1024) {
    console.error(`Invalid port: ${positional[0]}`);
    process.exit(1);
  }

  // Project name: given, else taken from the folder already allocated to this port.
  const existing = listProfiles().find((p) => p.port === port);
  const project = positional[1] || (existing ? existing.project : 'general');

  // The folder is the allocation. A second project on the same port would share
  // tabs with the first, so refuse rather than create a duplicate.
  if (existing && existing.project !== project) {
    console.error(`Port ${port} belongs to "${existing.project}". status.js prints the next free port.`);
    process.exit(1);
  }

  if (await isLive(port)) {
    console.log(`ALREADY_RUNNING port=${port} project=${project}`);
    return;
  }

  const dir = profileDir(project, port);
  const fresh = !fs.existsSync(dir);
  if (fresh) {
    // A brand-new profile means no cookies and no logins. Say so — for research
    // ports that is the difference between "works" and "hits a login wall".
    console.log(`NOTE new profile will be created: ${dir}`);
    console.log('     (to clone an existing profile instead: node new-profile.js <port> <from-port>)');
    fs.mkdirSync(dir, { recursive: true });
  }

  // Chrome is not running on this profile here, so it is safe to trim. Only past
  // the limit: a warm cache is worth keeping until it starts costing real space.
  const cached = trimProfile(dir, { dry: true });
  if (cached > TRIM_ABOVE_BYTES) {
    trimProfile(dir);
    console.log(`TRIMMED ${(cached / 1048576).toFixed(0)} MB of cache`);
  }

  const flags = [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${dir}`,
    '--no-first-run',
    '--no-default-browser-check',
    // No on-device AI models: browsing never needs them. Do not add
    // --disable-component-update (it also stops the Safe Browsing lists) or
    // --disk-cache-size (measured no effect); the trim above bounds the cache.
    '--disable-features=OptimizationGuideModelDownloading,OptimizationTargetPrediction,OptimizationHints,OptimizationHintsFetching,OptimizationGuideOnDeviceModel',
  ];
  // Visible is the default: the user wants to watch. Headless only on request —
  // it is also the right choice when the machine will be locked, since Win+L
  // stalls rendering and timers in a visible window.
  if (headless) flags.push('--headless=new');
  flags.push('about:blank');

  const child = spawn(chromeExe(), flags, { detached: true, stdio: 'ignore' });
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 750));
    if (await isLive(port)) {
      console.log(`STARTED port=${port} project=${project} ${headless ? '(headless)' : '(visible)'}`);
      console.log(`profile: ${dir}`);
      return;
    }
  }
  console.error(`FAILED port ${port} did not come up. Root: ${profilesRoot()}`);
  process.exit(1);
})();
