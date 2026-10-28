import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Detect available external media players on the system
 * @returns {Array<{ id: 'mpv'|'vlc', name: string, binPath: string }>}
 */
export function detectExternalPlayers() {
  const available = [];

  // 1. Check MPV
  const mpvPath = findExecutable('mpv');
  if (mpvPath) {
    available.push({ id: 'mpv', name: 'MPV Player', binPath: mpvPath });
  }

  // 2. Check VLC
  let vlcPath = findExecutable('vlc');
  if (!vlcPath && process.platform === 'win32') {
    const defaultPaths = [
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
    ];
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) {
        vlcPath = p;
        break;
      }
    }
  }
  if (vlcPath) {
    available.push({ id: 'vlc', name: 'VLC Media Player', binPath: vlcPath });
  }

  return available;
}

/**
 * Find executable in system PATH
 * @param {string} cmd
 * @returns {string|null}
 */
function findExecutable(cmd) {
  try {
    const checkCmd = process.platform === 'win32' ? `where.exe ${cmd}` : `which ${cmd}`;
    const output = execSync(checkCmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (output) {
      return output.split(/\r?\n/)[0];
    }
  } catch {}
  return null;
}

/**
 * Launch playback in an external player
 * @param {'mpv'|'vlc'} playerId
 * @param {object} options
 * @param {string} options.videoUrl
 * @param {string} options.title
 * @param {string} [options.referer]
 */
export function launchExternalPlayer(playerId, { videoUrl, title, referer }) {
  const players = detectExternalPlayers();
  const player = players.find(p => p.id === playerId);
  if (!player) {
    throw new Error(`Pemutar ${playerId.toUpperCase()} tidak ditemukan di sistem.`);
  }

  const args = [];

  if (playerId === 'mpv') {
    args.push(videoUrl);
    if (title) args.push(`--title=${title}`);
    if (referer) args.push(`--referrer=${referer}`);
  } else if (playerId === 'vlc') {
    args.push(videoUrl);
    if (title) args.push(`--meta-title=${title}`);
    if (referer) args.push(`--http-referrer=${referer}`);
  }

  const proc = spawn(player.binPath, args, {
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();

  return player;
}
