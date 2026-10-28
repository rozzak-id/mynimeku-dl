import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.animeku');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');
const MAX_HISTORY_ITEMS = 25;

function ensureDirExists() {
  if (!fs.existsSync(CONFIG_DIR)) {
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    } catch {}
  }
}

/**
 * Get all watch history items
 * @returns {Array<{
 *   seriesTitle: string,
 *   seriesUrl: string,
 *   episodeTitle: string,
 *   episodeNumber: string,
 *   episodeUrl: string,
 *   providerId: string,
 *   providerName: string,
 *   resolution: string,
 *   timestamp: number
 * }>}
 */
export function getHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Get the most recently watched anime
 */
export function getLatestWatched() {
  const list = getHistory();
  return list.length > 0 ? list[0] : null;
}

/**
 * Save or update watch progress
 * @param {object} item
 */
export function saveWatchProgress(item) {
  try {
    ensureDirExists();
    let history = getHistory();

    // Deduplicate by seriesTitle or seriesUrl
    history = history.filter(h => {
      if (item.seriesUrl && h.seriesUrl && h.seriesUrl === item.seriesUrl) return false;
      if (item.seriesTitle && h.seriesTitle && h.seriesTitle.toLowerCase() === item.seriesTitle.toLowerCase()) return false;
      return true;
    });

    history.unshift({
      seriesTitle: item.seriesTitle || item.title || 'Anime',
      seriesUrl: item.seriesUrl || '',
      episodeTitle: item.episodeTitle || item.title || '',
      episodeNumber: item.episodeNumber || '',
      episodeUrl: item.episodeUrl || '',
      providerId: item.providerId || '',
      providerName: item.providerName || '',
      resolution: item.resolution || '720P',
      timestamp: Date.now()
    });

    if (history.length > MAX_HISTORY_ITEMS) {
      history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all watch history
 */
export function clearHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
    return true;
  } catch {
    return false;
  }
}
