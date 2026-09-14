// Debug Chrome allocation table: which port is taken, which is live, tabs open.
//   node status.js
//
// The FOLDER NAMES are the registry. Ports are read off disk, never hardcoded,
// so a port added later shows up without editing this file.
const path = require('path');
const http = require('http');
const { profilesRoot, listProfiles, foreignProfiles } = require('../lib/paths.js');
const fs = require('fs');

// Shown even when their folder is missing, so a freed port is still visible.
const BASE_PORTS = [9333];

function get(port, route) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: route, timeout: 1200 },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function dirSizeMB(dir) {
  let total = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else { try { total += fs.statSync(full).size; } catch { /* locked file */ } }
    }
  };
  walk(dir);
  return (total / 1048576).toFixed(0);
}

(async () => {
  const profiles = listProfiles();
  const byPort = Object.fromEntries(profiles.map((p) => [p.port, p]));
  const ports = [...new Set([...BASE_PORTS, ...profiles.map((p) => p.port)])].sort((a, b) => a - b);

  console.log('PROFILES ROOT:', profilesRoot());
  console.log('');
  console.log('PORT  PROJECT          LIVE  TABS  PROFILE_MB  FOLDER');
  console.log('----  ---------------  ----  ----  ----------  ------------------------');

  for (const port of ports) {
    const info = byPort[port];
    const live = !!(await get(port, '/json/version'));
    let tabs = '-';
    if (live) {
      const list = await get(port, '/json/list');
      tabs = Array.isArray(list) ? String(list.filter((t) => t.type === 'page').length) : '?';
    }
    console.log(
      String(port).padEnd(6) +
        (info ? info.project : '(unassigned)').padEnd(17) +
        (live ? 'YES ' : 'no  ').padEnd(6) +
        String(tabs).padEnd(6) +
        (info ? dirSizeMB(info.dir) : '-').padEnd(12) +
        (info ? info.name : '-')
    );
  }

  // Pre-existing profiles on a different scheme: never clean, rename or launch these.
  const foreign = foreignProfiles();
  if (foreign.length) {
    console.log('');
    console.log('Outside this system (DO NOT TOUCH):', foreign.join(', '));
  }

  // Tab titles confirm whose instance a port really is, before you drive it.
  for (const port of ports) {
    const list = await get(port, '/json/list');
    if (Array.isArray(list)) {
      const pages = list.filter((t) => t.type === 'page');
      if (pages.length) {
        console.log('');
        console.log(`Port ${port} open tabs:`);
        pages.slice(0, 8).forEach((t) =>
          console.log('  -', (t.title || '(no title)').slice(0, 70), '|', (t.url || '').slice(0, 60))
        );
      }
    }
  }
})();
