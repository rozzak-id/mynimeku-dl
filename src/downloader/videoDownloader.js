import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import cliProgress from 'cli-progress';
import pc from 'picocolors';
import { request } from '../core/httpClient.js';
import { CONFIG } from '../config.js';

/**
 * Format bytes to human readable format (MB, GB, etc.)
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Sanitize filename for safe filesystem storage
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .trim();
}

/**
 * Download a video file with progress tracking and resume support
 * @param {string} downloadUrl
 * @param {object} options
 * @param {string} [options.outputDir]
 * @param {string} [options.filename]
 * @param {string} [options.referer]
 * @param {boolean} [options.showProgress=true]
 * @param {boolean} [options.resume=true]
 * @returns {Promise<{ filePath: string, totalBytes: number }>}
 */
export async function downloadVideo(downloadUrl, options = {}) {
  const outputDir = options.outputDir || CONFIG.DEFAULT_DOWNLOAD_DIR;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Initial head probe to determine filename and size
  let filename = options.filename;
  let expectedTotal = 0;

  const initialHeaders = {
    'Referer': options.referer || CONFIG.BASE_URL
  };

  // If filename is not provided upfront and resume is enabled,
  // do a lightweight HEAD probe first to resolve the real filename.
  // This allows checking existing bytes on disk BEFORE sending the GET request with Range.
  if (!filename && options.resume !== false) {
    try {
      const headRes = await request(downloadUrl, {
        method: 'HEAD',
        headers: initialHeaders,
        redirect: 'follow',
        timeout: 8000
      });
      if (headRes.ok) {
        const disposition = headRes.headers.get('content-disposition');
        if (disposition) {
          const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
          if (match) {
            try {
              filename = decodeURIComponent(match[1]);
            } catch {
              filename = match[1];
            }
          }
        }
        if (!filename) {
          const u = new URL(headRes.url || downloadUrl);
          const name = u.pathname.split('/').filter(Boolean).pop();
          if (name && name.includes('.')) {
            try {
              filename = decodeURIComponent(name);
            } catch {
              filename = name;
            }
          }
        }
      }
    } catch {
      // Fallback: proceed to GET
    }
  }

  let existingBytes = 0;
  let targetFilePath = '';

  if (filename) {
    filename = sanitizeFilename(filename);
    targetFilePath = path.join(outputDir, filename);
    if (options.resume !== false && fs.existsSync(targetFilePath)) {
      existingBytes = fs.statSync(targetFilePath).size;
    }
  }

  const reqHeaders = { ...initialHeaders };
  if (existingBytes > 0) {
    reqHeaders['Range'] = `bytes=${existingBytes}-`;
  }

  const response = await request(downloadUrl, {
    method: 'GET',
    headers: reqHeaders,
    redirect: 'follow',
    timeout: 0 // Do not timeout active streaming downloads
  });

  if (!response.ok && response.status !== 206) {
    // If range request was not satisfiable (416), file is probably fully downloaded
    if (response.status === 416 && existingBytes > 0) {
      console.log(pc.green(`✔ File sudah selesai didownload sebelumnya: ${filename}`));
      return { filePath: targetFilePath, totalBytes: existingBytes };
    }
    throw new Error(`Gagal mendownload video [HTTP ${response.status} ${response.statusText}]`);
  }

  // Determine filename from response if still not provided
  if (!filename) {
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
      if (match) {
        try {
          filename = decodeURIComponent(match[1]);
        } catch {
          filename = match[1];
        }
      }
    }

    if (!filename) {
      try {
        const u = new URL(response.url || downloadUrl);
        const name = u.pathname.split('/').filter(Boolean).pop();
        if (name && name.includes('.')) filename = decodeURIComponent(name);
      } catch {
        // ignore
      }
    }

    if (!filename) {
      filename = `anime_video_${Date.now()}.mp4`;
    }

    filename = sanitizeFilename(filename);
    targetFilePath = path.join(outputDir, filename);

    // If file already exists on disk and resume is on, but we didn't send Range earlier:
    if (options.resume !== false && fs.existsSync(targetFilePath)) {
      const diskSize = fs.statSync(targetFilePath).size;
      const contentLengthHeader = response.headers.get('content-length');
      const totalFromServer = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      if (diskSize > 0) {
        // Cancel the current 200 response body stream
        try { response.body?.cancel(); } catch {}

        if (totalFromServer > 0 && diskSize >= totalFromServer) {
          console.log(pc.green(`✔ File lengkap sudah ada: ${filename} (${formatBytes(diskSize)})`));
          return { filePath: targetFilePath, totalBytes: diskSize };
        }

        // Partial download: re-invoke with the discovered filename so Range header is properly sent!
        return await downloadVideo(downloadUrl, {
          ...options,
          filename
        });
      }
    }
  }

  // Content Length
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    expectedTotal = parseInt(contentLength, 10) + (response.status === 206 ? existingBytes : 0);
  } else {
    expectedTotal = existingBytes;
  }

  // Check if file is already completely downloaded
  if (expectedTotal > 0 && existingBytes >= expectedTotal) {
    try { response.body?.cancel(); } catch {}
    console.log(pc.green(`✔ File lengkap sudah ada: ${filename} (${formatBytes(existingBytes)})`));
    return { filePath: targetFilePath, totalBytes: existingBytes };
  }

  // Setup CLI progress bar
  let progressBar = null;
  let downloadedBytes = existingBytes;
  const startTime = Date.now();
  let lastTime = startTime;
  let lastBytes = existingBytes;

  if (options.showProgress !== false) {
    console.log(pc.cyan(`\n📥 Memulai download: ${pc.bold(filename)}`));
    console.log(pc.dim(`📁 Lokasi: ${targetFilePath}`));

    progressBar = new cliProgress.SingleBar({
      format: `${pc.cyan('{bar}')} ${pc.yellow('{percentage}%')} | ${pc.green('{downloaded}')}/{total} | ${pc.magenta('{speed}')} | ETA: {eta}s`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false
    }, cliProgress.Presets.shades_classic);

    progressBar.start(expectedTotal > 0 ? expectedTotal : 100, downloadedBytes, {
      downloaded: formatBytes(downloadedBytes),
      total: expectedTotal > 0 ? formatBytes(expectedTotal) : 'Unknown',
      speed: '0 KB/s',
      eta: '?'
    });
  }

  const writeStream = fs.createWriteStream(targetFilePath, {
    flags: response.status === 206 ? 'a' : 'w'
  });

  const nodeReadable = Readable.fromWeb(response.body);

  await new Promise((resolve, reject) => {
    nodeReadable.on('data', (chunk) => {
      downloadedBytes += chunk.length;

      if (progressBar) {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;

        let speedStr = '0 KB/s';
        if (timeDiff >= 0.5) {
          const bytesDiff = downloadedBytes - lastBytes;
          const speedBytes = bytesDiff / timeDiff;
          speedStr = `${formatBytes(speedBytes)}/s`;
          lastTime = now;
          lastBytes = downloadedBytes;
        }

        const remainingBytes = Math.max(0, expectedTotal - downloadedBytes);
        const elapsedSec = (now - startTime) / 1000 || 1;
        const avgSpeed = (downloadedBytes - existingBytes) / elapsedSec;
        const etaSeconds = avgSpeed > 0
          ? Math.round(remainingBytes / avgSpeed)
          : '?';

        progressBar.update(downloadedBytes, {
          downloaded: formatBytes(downloadedBytes),
          total: expectedTotal > 0 ? formatBytes(expectedTotal) : 'Unknown',
          speed: speedStr,
          eta: etaSeconds
        });
      }
    });

    nodeReadable.pipe(writeStream);

    writeStream.on('finish', () => {
      if (progressBar) {
        progressBar.update(expectedTotal > 0 ? expectedTotal : downloadedBytes, {
          downloaded: formatBytes(downloadedBytes),
          total: formatBytes(downloadedBytes),
          speed: 'Done',
          eta: '0'
        });
        progressBar.stop();
      }
      resolve();
    });

    writeStream.on('error', (err) => {
      if (progressBar) progressBar.stop();
      reject(err);
    });

    nodeReadable.on('error', (err) => {
      if (progressBar) progressBar.stop();
      reject(err);
    });
  });

  console.log(pc.green(`✔ Selesai! Tersimpan di: ${targetFilePath} (${formatBytes(downloadedBytes)})\n`));

  return {
    filePath: targetFilePath,
    totalBytes: downloadedBytes
  };
}
