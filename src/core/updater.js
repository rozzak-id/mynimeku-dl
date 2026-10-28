import { request } from './httpClient.js';

const REMOTE_PKG_URL = 'https://raw.githubusercontent.com/rozzak-id/mynimeku-dl/main/package.json';

/**
 * Check if a newer version is available on GitHub
 * @param {string} currentVersion
 * @returns {Promise<{ hasUpdate: boolean, latestVersion?: string, repoUrl?: string }>}
 */
export async function checkForUpdate(currentVersion) {
  try {
    const res = await request(REMOTE_PKG_URL, {
      method: 'GET',
      timeout: 2500,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.version && isNewerVersion(currentVersion, data.version)) {
        return {
          hasUpdate: true,
          latestVersion: data.version,
          repoUrl: 'https://github.com/rozzak-id/mynimeku-dl'
        };
      }
    }
  } catch {
    // Non-blocking, ignore errors silently
  }

  return { hasUpdate: false };
}

/**
 * Compare semver versions
 */
function isNewerVersion(current, remote) {
  if (!current || !remote || current === remote) return false;
  const cParts = current.split('.').map(n => parseInt(n, 10) || 0);
  const rParts = remote.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
    const c = cParts[i] || 0;
    const r = rParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}
