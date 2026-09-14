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

  const flags = [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${dir}`,
    '--no-first-run',
    '--no-default-browser-check',
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
