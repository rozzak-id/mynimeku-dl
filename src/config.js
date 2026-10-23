import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/**
 * Resolve the user's default download directory across platforms:
 * - Environment variable: DOWNLOAD_DIR (if set)
 * - Android / Termux: ~/storage/downloads, /sdcard/Download, etc.
 * - Windows / macOS / Linux: User's system Downloads folder (~/Downloads)
 * - Fallback: process.cwd()/downloads
 * @returns {string}
 */
export function getDefaultDownloadDir() {
  if (process.env.DOWNLOAD_DIR) {
    return path.resolve(process.env.DOWNLOAD_DIR);
  }

  // 1. Check for Termux (Android) environment
  const isTermux = Boolean(
    process.env.TERMUX_VERSION ||
    process.env.PREFIX?.includes('com.termux') ||
    fs.existsSync('/data/data/com.termux')
  );

  if (isTermux) {
    const termuxPaths = [
      path.join(os.homedir(), 'storage', 'downloads'),
      '/sdcard/Download',
      '/storage/emulated/0/Download',
      path.join(os.homedir(), 'storage', 'shared', 'Download'),
      path.join(os.homedir(), 'downloads')
    ];

    for (const targetPath of termuxPaths) {
      try {
        if (fs.existsSync(targetPath)) {
          return targetPath;
        }
      } catch {
        // ignore permission or access check failures
      }
    }
  }

  // 2. Standard PC / Laptop (Windows, macOS, Linux)
  try {
    const userDownloads = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(userDownloads)) {
      return userDownloads;
    }
    if (fs.existsSync(os.homedir())) {
      fs.mkdirSync(userDownloads, { recursive: true });
      return userDownloads;
    }
  } catch {
    // fallback if os.homedir() is restricted
  }

  // 3. Fallback
  return path.resolve(process.cwd(), 'downloads');
}

export const CONFIG = {
  BASE_URL: process.env.MYNIMEKU_BASE_URL || 'https://www.mynimeku.com',
  DEFAULT_DOWNLOAD_DIR: getDefaultDownloadDir(),
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  DEFAULT_HEADERS: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  },
  DEFAULT_RESOLUTION: '720P',
  FALLBACK_RESOLUTIONS: ['1080P', '720P', '480P', '360P'],
  REQUEST_TIMEOUT_MS: 30000,
  BATCH_DELAY_MS: 2000
};
