// Which machine is this, and what are its per-machine values?
//
// One shared config runs on several PCs. Everything that differs between them
// lives in ~/.claude/machines.json, keyed by hostname — like a translations
// file keyed by locale. Scripts ask here instead of hardcoding a path.
//
//   const M = require('~/.claude/scripts/machine.js');
//   M.id()                  -> "work_pc"
//   M.get('chromeProfilesRoot')  -> absolute path, ~ already expanded
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG = path.join(os.homedir(), '.claude', 'machines.json');

let cache = null;

// Built in, so a machine with no machines.json (a fresh install) still resolves
// to usable neutral paths instead of null. The file's own _default overrides it.
const BUILTIN_DEFAULT = {
  hostname: null,
  label: 'Unknown machine',
  chromeProfilesRoot: '~/dev/chrome_profiles',
  devRoot: null,
  notes: 'No machines.json found - using built-in neutral defaults.',
};

function load() {
  if (cache) return cache;
  let fromFile = {};
  try {
    fromFile = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).machines || {};
  } catch {
    fromFile = {}; // Missing or broken file must not break callers.
  }
  // File wins where it defines _default; the built-in fills the gaps.
  cache = { ...fromFile, _default: { ...BUILTIN_DEFAULT, ...(fromFile._default || {}) } };
  return cache;
}

// Hostname comparison is case-insensitive: Windows reports it inconsistently.
function id() {
  const host = os.hostname().toLowerCase();
  const machines = load();
  for (const [key, m] of Object.entries(machines)) {
    if (key === '_default') continue;
    if (m.hostname && m.hostname.toLowerCase() === host) return key;
  }
  return '_default';
}

function profile() {
  const machines = load();
  return machines[id()] || machines._default || {};
}

function expand(value) {
  if (typeof value !== 'string') return value;
  if (value.startsWith('~/') || value === '~') {
    return path.join(os.homedir(), value.slice(1));
  }
  return value;
}

// One per-machine value, with ~ expanded. Falls back to _default, then to the
// caller's own fallback.
function get(key, fallback = null) {
  const machines = load();
  const mine = profile();
  const def = machines._default || {};
  const value = mine[key] !== undefined && mine[key] !== null ? mine[key] : def[key];
  return value === undefined || value === null ? fallback : expand(value);
}

function label() {
  return profile().label || 'Unknown machine';
}

// Every machine in the file — for reporting, never for reading another's paths.
function all() {
  return load();
}

module.exports = { id, get, label, profile, all, CONFIG };

// Run directly to see what this machine resolves to.
if (require.main === module) {
  console.log('hostname :', os.hostname());
  console.log('machine  :', id(), `(${label()})`);
  console.log('profiles :', get('chromeProfilesRoot'));
  console.log('devRoot  :', get('devRoot'));
  const n = profile().notes;
  if (n) console.log('notes    :', n);
}
