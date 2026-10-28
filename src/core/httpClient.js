const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  if (warning?.message?.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  return originalEmitWarning.call(process, warning, ...args);
};
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import dns from 'node:dns';
import { CONFIG } from '../config.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

/**
 * Perform a GET request with timeout and headers
 * @param {string} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 */
export async function request(url, options = {}) {
  const timeout = options.timeout ?? CONFIG.REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = timeout > 0
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  let defaultReferer = CONFIG.BASE_URL;
  try {
    defaultReferer = new URL(url).origin + '/';
  } catch {}

  const headers = {
    'User-Agent': CONFIG.USER_AGENT,
    'Referer': defaultReferer,
    ...CONFIG.DEFAULT_HEADERS,
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms for URL: ${url}`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Fetch HTML text
 * @param {string} url
 * @param {string} [referer]
 * @returns {Promise<string>}
 */
export async function getHtml(url, referer) {
  let targetReferer = referer;
  if (!targetReferer) {
    try {
      targetReferer = new URL(url).origin + '/';
    } catch {
      targetReferer = CONFIG.BASE_URL;
    }
  }

  const res = await request(url, {
    headers: {
      'Referer': targetReferer
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch HTML [${res.status} ${res.statusText}] from ${url}`);
  }

  return await res.text();
}

/**
 * Fetch HEAD metadata of a URL
 * @param {string} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 */
export async function getHead(url, options = {}) {
  return await request(url, {
    method: 'HEAD',
    redirect: 'follow',
    ...options
  });
}
