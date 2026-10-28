import http from 'node:http';
import { exec } from 'node:child_process';
import pc from 'picocolors';

/**
 * Launch a temporary local Ad-Free Mini Player app in the browser
 * @param {object} options
 * @param {string} options.title - Anime & Episode Title
 * @param {string} options.videoUrl - Direct video stream URL
 * @param {string} [options.referer] - Optional referer header for streaming
 * @param {string} [options.sourceName] - Source website name
 * @param {string} [options.resolution] - Video resolution (e.g. 720P)
 * @returns {Promise<{ server: http.Server, url: string, close: () => void }>}
 */
export async function launchMiniPlayer({ title, videoUrl, referer, sourceName = 'Animeku', resolution = '720P' }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://${req.headers.host}`);

      // Route: Stream proxy (to bypass CORS or Referer restrictions)
      if (reqUrl.pathname === '/stream') {
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': '*/*'
        };
        if (referer) headers['Referer'] = referer;
        if (req.headers.range) headers['Range'] = req.headers.range;

        fetch(videoUrl, { headers })
          .then(fetchRes => {
            const forwardHeaders = {
              'Content-Type': fetchRes.headers.get('content-type') || 'video/mp4',
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            };
            if (fetchRes.headers.get('content-length')) {
              forwardHeaders['Content-Length'] = fetchRes.headers.get('content-length');
            }
            if (fetchRes.headers.get('content-range')) {
              forwardHeaders['Content-Range'] = fetchRes.headers.get('content-range');
            }

            res.writeHead(fetchRes.status, forwardHeaders);
            if (fetchRes.body) {
              const reader = fetchRes.body.getReader();
              function pump() {
                reader.read().then(({ done, value }) => {
                  if (done) {
                    res.end();
                    return;
                  }
                  res.write(Buffer.from(value));
                  pump();
                }).catch(() => res.end());
              }
              pump();
            } else {
              res.end();
            }
          })
          .catch(err => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Proxy stream error: ${err.message}`);
          });
        return;
      }

      // Route: Main HTML5 Player Page
      const cleanTitle = escapeHtml(title);
      const cleanSource = escapeHtml(sourceName);
      const cleanRes = escapeHtml(resolution);
      const cleanUrl = videoUrl;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanTitle} - Animeku</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f1115;
      color: #e5e7eb;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .player-card {
      width: 100%;
      max-width: 980px;
      background: #181b20;
      border: 1px solid #282d37;
      border-radius: 6px;
      overflow: hidden;
    }
    .player-header {
      padding: 14px 20px;
      background: #13161a;
      border-bottom: 1px solid #282d37;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
      color: #f3f4f6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-tags {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .tag {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .tag-source {
      background: #232730;
      color: #9ca3af;
      border: 1px solid #323844;
    }
    .tag-res {
      background: #0284c7;
      color: #ffffff;
    }
    .video-viewport {
      position: relative;
      width: 100%;
      padding-top: 56.25%;
      background: #000000;
    }
    video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      outline: none;
    }
    .player-footer {
      padding: 12px 20px;
      background: #13161a;
      border-top: 1px solid #282d37;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #232730;
      color: #d1d5db;
      border: 1px solid #323844;
    }
    .btn-secondary:hover {
      background: #2c323e;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="player-card">
    <div class="player-header">
      <div class="title" title="${cleanTitle}">${cleanTitle}</div>
      <div class="meta-tags">
        <span class="tag tag-source">${cleanSource}</span>
        <span class="tag tag-res">${cleanRes}</span>
      </div>
    </div>
    
    <div class="video-viewport">
      <video id="player" controls autoplay preload="auto">
        <source src="/stream" type="video/mp4">
        <source src="${cleanUrl}" type="video/mp4">
      </video>
    </div>

    <div class="player-footer">
      <a href="${cleanUrl}" target="_blank" class="btn btn-secondary">Direct Link</a>
      <a href="${cleanUrl}" download class="btn btn-primary">Download Video</a>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script>
    const video = document.getElementById('player');
    const streamUrl = '${cleanUrl}';

    if (streamUrl.includes('.m3u8')) {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          video.play().catch(function() {});
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      }
    }

    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      } else if (e.code === 'ArrowRight') {
        video.currentTime += 5;
      } else if (e.code === 'ArrowLeft') {
        video.currentTime -= 5;
      } else if (e.code === 'KeyF') {
        if (!document.fullscreenElement) {
          video.requestFullscreen().catch(function() {});
        } else {
          document.exitFullscreen().catch(function() {});
        }
      }
    });
  </script>
</body>
</html>`);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const playerUrl = `http://localhost:${port}`;

      // Open in default browser on Windows / Mac / Linux
      const startCmd = process.platform === 'win32' ? `start "" "${playerUrl}"` :
                       process.platform === 'darwin' ? `open "${playerUrl}"` : `xdg-open "${playerUrl}"`;
      
      exec(startCmd, () => {});

      resolve({
        server,
        url: playerUrl,
        close: () => server.close()
      });
    });

    server.on('error', reject);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/[()]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{25A0}-\u{25FF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}
