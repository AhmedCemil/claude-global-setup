// Machine-portable path resolution for the debug-Chrome system.
//
// Nothing here may hardcode a user name or a machine-specific folder: the same
// files run on every machine, and their home dirs and profile roots differ.
// Per-machine values come from ~/.claude/machines.json via scripts/machine.js —
// this file only knows HOW to resolve, never WHICH machine it is on.
//
// Order:
//   1. $CLAUDE_CHROME_PROFILES        explicit override, wins over everything
//   2. machines.json -> chromeProfilesRoot for this hostname
//   3. ~/dev/chrome_profiles          neutral fallback
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const NEUTRAL_FALLBACK = ['dev', 'chrome_profiles'];

function machineRoot() {
  try {
    const M = require(path.join(os.homedir(), '.claude', 'scripts', 'machine.js'));
    return M.get('chromeProfilesRoot');
  } catch {
    return null; // machines.json missing or unreadable -> fall through
  }
}

// Resolve the profiles root for this machine.
// { create: true } makes the directory instead of only naming it.
function profilesRoot({ create = false } = {}) {
  const root =
    process.env.CLAUDE_CHROME_PROFILES ||
    machineRoot() ||
    path.join(os.homedir(), ...NEUTRAL_FALLBACK);

  if (create) fs.mkdirSync(root, { recursive: true });
  return root;
}

// puppeteer-core is installed GLOBALLY and the npm prefix differs per machine,
// so the path is asked for, never written down. NODE_PATH short-circuits the
// (slow) npm call when the caller already set it.
function puppeteer() {
  let root = process.env.NODE_PATH;
  if (!root) {
    try {
      root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      throw new Error(
        'Cannot locate global node_modules. Set NODE_PATH, or check that npm is on PATH.'
      );
    }
  }
  try {
    return require(path.join(root, 'puppeteer-core'));
  } catch {
    throw new Error(`puppeteer-core not found in ${root}. Install it: npm i -g puppeteer-core`);
  }
}

// <name>_debug_<port> is the registry: the folder names ARE the allocation table.
const PROFILE_RE = /^(.*)_debug_(\d+)$/;

// Every allocated profile on this machine, newest scheme only.
function listProfiles() {
  const root = profilesRoot();
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && PROFILE_RE.test(e.name))
    .map((e) => {
      const [, project, port] = e.name.match(PROFILE_RE);
      return { name: e.name, project, port: Number(port), dir: path.join(root, e.name) };
    })
    .sort((a, b) => a.port - b.port);
}

// Folders in the root that predate this scheme. Never clean or launch these.
function foreignProfiles() {
  const root = profilesRoot();
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !PROFILE_RE.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function profileDir(project, port) {
  return path.join(profilesRoot(), `${project}_debug_${port}`);
}

// Chrome's location is stable on Windows, but check both Program Files roots.
function chromeExe() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('chrome.exe not found in either Program Files location.');
}

module.exports = {
  profilesRoot,
  puppeteer,
  listProfiles,
  foreignProfiles,
  profileDir,
  chromeExe,
  PROFILE_RE,
};
