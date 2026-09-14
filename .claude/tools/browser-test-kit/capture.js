// capture.js — screenshots + SS→GIF stitching. APP-AGNOSTIC (KATMAN 1).
//
// The checkpoint (2026-07-28) identified GIF stitching as the ONLY genuinely-new
// piece: page.screenshot, the visible cursor, captions, and setInterval anim
// already exist and are proven. This module adds the stitch on top.
//
// GIF path uses ffmpeg (found on PATH or via FFMPEG env). No npm dependency, no
// install step. If ffmpeg is absent, snap() still works and toGif() fails soft
// with a clear message + the frame dir, so a demo run degrades to a PNG strip
// rather than crashing a test.
//
// Same frames serve two masters (the checkpoint's "one step → test assert AND
// demo frame"): a verify run can snap key states for evidence; a demo run snaps
// every beat and stitches a captioned GIF.

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function ffmpegPath() {
    return process.env.FFMPEG || 'ffmpeg';
}

export function hasFfmpeg() {
    try {
        const r = spawnSync(ffmpegPath(), ['-version'], { encoding: 'utf8' });
        return r.status === 0;
    } catch { return false; }
}

// A Recorder snaps numbered PNG frames into <dir>/frames and can stitch them to
// a GIF. Create one per demo/verify run.
//
//   const rec = new Recorder(page, 'd:/Dev/orgmap/review/gif/enroll');
//   await rec.snap('login');            // frames/0000.png
//   await rec.snap('firm-open', 3);     // hold 3 frames (dwell on a state)
//   await rec.toGif({ fps: 2, width: 1280 });   // <dir>/enroll.gif
export class Recorder {
    constructor(page, outDir, { name } = {}) {
        this.page = page;
        this.outDir = resolve(outDir);
        this.name = name || basename(this.outDir);
        this.framesDir = join(this.outDir, 'frames');
        this.count = 0;
        this.labels = [];
        mkdirSync(this.framesDir, { recursive: true });
    }

    // Snap one frame (optionally repeated `hold` times to dwell on a state in the
    // final GIF). `label` is recorded for the manifest, not burned into the image
    // (captions are drawn live via real-input.caption before snapping).
    async snap(label = '', hold = 1) {
        for (let i = 0; i < Math.max(1, hold); i++) {
            const file = join(this.framesDir, String(this.count).padStart(4, '0') + '.png');
            await this.page.screenshot({ path: file });
            this.labels.push({ frame: this.count, label });
            this.count++;
        }
        return this.count;
    }

    // Stitch frames/*.png → <outDir>/<name>.gif. Returns the gif path, or null
    // if ffmpeg is unavailable (fails soft: frames remain on disk).
    async toGif({ fps = 2, width = 1280, loop = 0 } = {}) {
        if (this.count === 0) throw new Error('Recorder.toGif: no frames snapped');
        const gif = join(this.outDir, this.name + '.gif');
        if (!hasFfmpeg()) {
            console.log(`  [capture] ffmpeg not found — ${this.count} PNG frames left in ${this.framesDir}`);
            console.log('  [capture] set FFMPEG=/path/to/ffmpeg or add it to PATH to stitch a GIF');
            return null;
        }
        // Two-pass palette for clean GIF colors (ffmpeg standard recipe).
        // Declare -framerate on the INPUT so ffmpeg reads the PNG sequence at our
        // playback rate; the scale filter only resizes. (Using an `fps=` filter
        // here instead would resample against an assumed 25fps input and drop all
        // frames when there are only a few — the empty-palette bug.)
        const pattern = join(this.framesDir, '%04d.png');
        const palette = join(this.outDir, '_palette.png');
        const scale = `scale=${width}:-1:flags=lanczos`;
        const p1 = spawnSync(ffmpegPath(), [
            '-y', '-framerate', String(fps), '-i', pattern,
            '-vf', `${scale},palettegen`, palette,
        ], { encoding: 'utf8' });
        if (p1.status !== 0 || !existsSync(palette)) {
            console.log('  [capture] palettegen failed:', (p1.stderr || '').slice(-400));
            return null;
        }
        const p2 = spawnSync(ffmpegPath(), [
            '-y', '-framerate', String(fps), '-i', pattern, '-i', palette,
            '-lavfi', `${scale} [x]; [x][1:v] paletteuse`, '-loop', String(loop), gif,
        ], { encoding: 'utf8' });
        try { rmSync(palette, { force: true }); } catch {}
        if (p2.status !== 0) { console.log('  [capture] gif stitch failed:', (p2.stderr || '').slice(-300)); return null; }
        console.log(`  [capture] GIF: ${gif} (${this.count} frames @ ${fps}fps)`);
        return gif;
    }

    // Wipe the frames dir (call before a fresh run to avoid mixing old frames).
    clean() {
        if (existsSync(this.framesDir)) {
            for (const f of readdirSync(this.framesDir)) rmSync(join(this.framesDir, f), { force: true });
        }
        this.count = 0; this.labels = [];
    }
}

// One-off screenshot to an explicit path (evidence shots in verify runs).
export async function shot(page, path) {
    const p = resolve(path);
    mkdirSync(dirname(p), { recursive: true });
    await page.screenshot({ path: p });
    return p;
}

function basename(p) { return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'demo'; }
function dirname(p) { return p.replace(/[\\/][^\\/]*$/, '') || '.'; }
