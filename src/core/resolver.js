import * as cheerio from 'cheerio';
import { request, getHtml } from './httpClient.js';
import { CONFIG } from '../config.js';

/**
 * Resolves a download or video URL to a direct downloadable media stream
 * @param {string} url - The initial download/video URL
 * @param {object} [options={}]
 * @returns {Promise<{
 *   directUrl: string,
 *   filename: string,
 *   fileSize: number,
 *   mimeType: string,
 *   serverType: string
 * }>}
 */
export async function resolveVideoUrl(url, options = {}) {
  const referer = options.referer || CONFIG.BASE_URL;

  // 1. Check if URL is from file.mydriveku.my.id
  if (url.includes('mydriveku.my.id')) {
    return await resolveMyDriveKu(url, referer);
  }

  // 2. Generic direct video URL handler
  return await resolveGenericVideo(url);
}

/**
 * Resolves MyDriveKu intermediate download page to direct worker URL
 * @param {string} pageUrl
 * @param {string} referer
 */
async function resolveMyDriveKu(pageUrl, referer) {
  // Fetch intermediate page
  const html = await getHtml(pageUrl, referer);
  const $ = cheerio.load(html);

  // Look for the download button link
  let downloadPath = $('a.download-btn').attr('href');
  
  if (!downloadPath) {
    const match = html.match(/href=["'](\/(?:public|private|drive)\/[^"']+)["']/i);
    if (match) {
      downloadPath = match[1];
    }
  }

  if (!downloadPath) {
    throw new Error(`Tidak dapat menemukan tombol download pada halaman gateway MyDriveKu (${pageUrl})`);
  }

  const directGatewayUrl = new URL(downloadPath, pageUrl).toString();

  // Follow the redirect to get the actual direct download URL
  const res = await request(directGatewayUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'Referer': pageUrl
    }
  });

  let directVideoUrl = directGatewayUrl;

  // If it's a drive endpoint and redirects to Google login, reject
  if (downloadPath.startsWith('/drive/')) {
    const loc = res.headers.get('location') || '';
    if (loc.includes('accounts.google.com')) {
      throw new Error('Server DRIVE ini membutuhkan login Google OAuth. Silakan gunakan server CLOUD atau PRIVATE.');
    }
  }

  // If 301/302, location is the real video stream URL
  if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
    const loc = res.headers.get('location');
    if (loc) {
      directVideoUrl = loc;
    }
  }

  // Probe the final video URL to get filename, size, and type
  const meta = await probeVideoMetadata(directVideoUrl, pageUrl);

  return {
    directUrl: directVideoUrl,
    filename: meta.filename || extractFilenameFromUrl(directVideoUrl) || 'anime_episode.mp4',
    fileSize: meta.fileSize || 0,
    mimeType: meta.mimeType || 'video/mp4',
    serverType: 'MyDriveKu-Cloud'
  };
}

/**
 * Resolves a generic video URL
 * @param {string} videoUrl
 */
async function resolveGenericVideo(videoUrl) {
  const meta = await probeVideoMetadata(videoUrl);
  return {
    directUrl: videoUrl,
    filename: meta.filename || extractFilenameFromUrl(videoUrl) || 'video.mp4',
    fileSize: meta.fileSize || 0,
    mimeType: meta.mimeType || 'video/mp4',
    serverType: 'Direct'
  };
}

/**
 * Probe URL with HEAD or range GET to extract Content-Length, Content-Type, Content-Disposition
 * @param {string} url
 * @param {string} [referer]
 */
export async function probeVideoMetadata(url, referer) {
  const headers = {};
  if (referer) headers['Referer'] = referer;

  let filename = '';
  let fileSize = 0;
  let mimeType = 'video/mp4';

  try {
    const res = await request(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers
    });

    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      filename = parseFilenameFromDisposition(disposition);
    }

    const len = res.headers.get('content-length');
    if (len) {
      fileSize = parseInt(len, 10);
    }

    const type = res.headers.get('content-type');
    if (type) {
      mimeType = type.split(';')[0].trim();
    }
  } catch (err) {
    // If HEAD is not allowed, try a range GET for 1 byte
    try {
      const getRes = await request(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          ...headers,
          'Range': 'bytes=0-0'
        }
      });
      const disp = getRes.headers.get('content-disposition');
      if (disp) filename = parseFilenameFromDisposition(disp);

      const rangeHeader = getRes.headers.get('content-range');
      if (rangeHeader) {
        const match = rangeHeader.match(/\/(\d+)$/);
        if (match) fileSize = parseInt(match[1], 10);
      } else {
        const len = getRes.headers.get('content-length');
        if (len) fileSize = parseInt(len, 10);
      }

      const type = getRes.headers.get('content-type');
      if (type) mimeType = type.split(';')[0].trim();
    } catch (ignore) {
      // Fallback
    }
  }

  return { filename, fileSize, mimeType };
}

/**
 * Extract filename from Content-Disposition header
 * @param {string} disposition
 */
export function parseFilenameFromDisposition(disposition) {
  if (!disposition) return '';

  // filename*=UTF-8''...
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  // filename="..."
  const standardMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
  if (standardMatch) {
    try {
      return decodeURIComponent(standardMatch[1].trim());
    } catch {
      return standardMatch[1].trim();
    }
  }

  return '';
}

/**
 * Fallback to extract filename from URL path
 * @param {string} url
 */
export function extractFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const base = pathname.split('/').filter(Boolean).pop();
    if (base && (base.includes('.') || base.length < 50)) {
      return decodeURIComponent(base);
    }
  } catch {
    // ignore
  }
  return '';
}
