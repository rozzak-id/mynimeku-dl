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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>▶ Nonton: ${escapeHtml(title)} | Animeku</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0b0e14;
      color: #e2e8f0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .player-container {
      width: 100%;
      max-width: 1040px;
      background: #151a23;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(11, 14, 20, 0.4);
    }
    .badge-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }
    .badge-source { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-res { background: rgba(163, 230, 53, 0.15); color: #a3e635; border: 1px solid rgba(163, 230, 53, 0.3); }
    .badge-no-ads { background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 650px;
    }
    .video-wrapper {
      position: relative;
      width: 100%;
      padding-top: 56.25%; /* 16:9 Aspect Ratio */
      background: #000;
    }
    video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      outline: none;
    }
    .footer {
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(11, 14, 20, 0.6);
      flex-wrap: wrap;
      gap: 16px;
    }
    .hint {
      font-size: 13px;
      color: #94a3b8;
    }
    .hint kbd {
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: #e2e8f0;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .btn {
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 12px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    .btn-download {
      background: #a3e635;
      color: #0f172a;
    }
    .btn-download:hover {
      background: #bef264;
      transform: translateY(-1px);
    }
    .btn-direct {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .btn-direct:hover {
      background: #334155;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="player-container">
    <div class="header">
      <div class="title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
      <div class="badge-group">
        <span class="badge badge-source">${escapeHtml(sourceName)}</span>
        <span class="badge badge-res">${escapeHtml(resolution)}</span>
        <span class="badge badge-no-ads">🛡️ Bebas Iklan</span>
      </div>
    </div>
    
    <div class="video-wrapper">
      <video id="animePlayer" controls autoplay preload="auto">
        <source src="/stream" type="video/mp4">
        <source src="${escapeHtml(videoUrl)}" type="video/mp4">
        Browser Anda tidak mendukung HTML5 video.
      </video>
    </div>

    <div class="footer">
      <div class="hint">
        💡 Pintasan: <kbd>Spasi</kbd> Jeda/Putar • <kbd>←</kbd> <kbd>→</kbd> Lompat 5s • <kbd>F</kbd> Layar Penuh
      </div>
      <div class="actions">
        <a href="${escapeHtml(videoUrl)}" download class="btn btn-download">
          📥 Download Video Ini
        </a>
        <a href="${escapeHtml(videoUrl)}" target="_blank" class="btn btn-direct">
          🔗 Buka Direct Link
        </a>
      </div>
    </div>
  </div>

  <script>
    const player = document.getElementById('animePlayer');
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        player.paused ? player.play() : player.pause();
      } else if (e.code === 'ArrowRight') {
        player.currentTime += 5;
      } else if (e.code === 'ArrowLeft') {
        player.currentTime -= 5;
      } else if (e.code === 'KeyF') {
        if (!document.fullscreenElement) {
          player.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
