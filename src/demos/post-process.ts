/**
 * Global teardown: trims recorded videos based on timing markers
 * written by each test. Called automatically by Playwright after all tests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export default async function globalTeardown() {
  const recordingsDir = path.join(__dirname, 'recordings');
  if (!fs.existsSync(recordingsDir)) return;

  for (const entry of fs.readdirSync(recordingsDir)) {
    const testDir = path.join(recordingsDir, entry);
    if (!fs.statSync(testDir).isDirectory()) continue;

    const videoPath = path.join(testDir, 'video.webm');
    const markersPath = path.join(testDir, 'markers.json');
    if (!fs.existsSync(videoPath) || !fs.existsSync(markersPath)) continue;

    const markers = JSON.parse(fs.readFileSync(markersPath, 'utf-8'));
    const { startSec, endSec } = markers;
    if (typeof startSec !== 'number' || typeof endSec !== 'number') continue;

    const tmpPath = path.join(testDir, 'video_trimmed.webm');
    const cmd = [
      'ffmpeg',
      '-y',
      '-i',
      videoPath,
      '-ss',
      String(Math.max(0, startSec - 0.5)),
      '-to',
      String(endSec + 0.5),
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '2M',
      tmpPath,
    ].join(' ');

    try {
      execSync(cmd, { stdio: 'pipe', timeout: 120000 });
      fs.renameSync(tmpPath, videoPath);
      fs.unlinkSync(markersPath);
      console.log(`✓ Trimmed ${entry}: ${startSec.toFixed(1)}s → ${endSec.toFixed(1)}s`);
    } catch (e) {
      console.error(`✗ Failed to trim ${entry}:`, (e as Error).message);
    }
  }
}
