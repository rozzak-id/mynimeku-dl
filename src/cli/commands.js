import { Command } from 'commander';
import pc from 'picocolors';
import path from 'node:path';
import { searchAnime, getSeriesDetails, getEpisodeDetails } from '../scrapers/mynimeku.js';
import { resolveVideoUrl } from '../core/resolver.js';
import { downloadVideo, sanitizeFilename } from '../downloader/videoDownloader.js';
import { CONFIG } from '../config.js';

export function setupCommands() {
  const program = new Command();

  program
    .name('mynimeku-dl')
    .description('CLI tool & scraper to search, scrape, and download anime video episodes from MyNimeku')
    .version('1.0.0');

  // Command: search
  program
    .command('search <keyword>')
    .description('Cari anime berdasarkan kata kunci judul')
    .action(async (keyword) => {
      try {
        console.log(pc.cyan(`\n🔍 Mencari anime dengan kata kunci "${keyword}"...`));
        const results = await searchAnime(keyword);
        if (results.length === 0) {
          console.log(pc.yellow(`Tidak ditemukan hasil untuk "${keyword}".`));
          return;
        }

        console.log(pc.green(`\n✔ Ditemukan ${results.length} anime:\n`));
        results.forEach((item, i) => {
          console.log(`${pc.bold(`${i + 1}. ${item.title}`)}`);
          console.log(`   URL: ${pc.cyan(item.url)}`);
          console.log(`   Tipe: ${item.type || '-'} | Status: ${item.status || '-'} | Rating: ${item.rating || '-'}`);
          if (item.genres.length > 0) console.log(`   Genre: ${item.genres.join(', ')}`);
          console.log();
        });
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  // Command: download
  program
    .command('download <episodeUrl>')
    .description('Download video dari satu URL episode')
    .option('-r, --res <resolution>', 'Pilihan resolusi (contoh: 1080P, 720P, 480P, 360P)', '720P')
    .option('-o, --output <dir>', 'Direktori tujuan penyimpanan file')
    .option('-s, --server <server>', 'Pilihan server (contoh: CLOUD, PRIVATE)', 'CLOUD')
    .action(async (episodeUrl, options) => {
      try {
        console.log(pc.cyan(`\n⏳ Mengambil data episode: ${episodeUrl}`));
        const epData = await getEpisodeDetails(episodeUrl);

        console.log(pc.green(`✔ Judul: ${epData.title}`));

        const targetRes = options.res.toUpperCase();
        let servers = epData.downloads[targetRes];

        if (!servers || servers.length === 0) {
          console.log(pc.yellow(`Resolusi ${targetRes} tidak ditemukan. Menggunakan fallback...`));
          const fallback = CONFIG.FALLBACK_RESOLUTIONS.find(r => epData.downloads[r] && epData.downloads[r].length > 0);
          if (!fallback) {
            throw new Error('Tidak ada link download yang tersedia pada episode ini.');
          }
          servers = epData.downloads[fallback];
        }

        const chosenServer = servers.find(s => s.server.toUpperCase() === options.server.toUpperCase()) ||
                             servers.find(s => s.server === 'CLOUD') ||
                             servers.find(s => s.server === 'PRIVATE') ||
                             servers[0];

        console.log(pc.cyan(`Menggunakan server: ${chosenServer.server}`));
        const resolved = await resolveVideoUrl(chosenServer.url);

        const outDir = options.output ? path.resolve(options.output) : CONFIG.DEFAULT_DOWNLOAD_DIR;
        const filename = sanitizeFilename(`${epData.title}_${targetRes}.mp4`);

        await downloadVideo(resolved.directUrl, {
          outputDir: outDir,
          filename,
          referer: chosenServer.url
        });
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  // Command: batch
  program
    .command('batch <seriesUrl>')
    .description('Batch download seluruh / rentang episode dari satu serial anime')
    .option('-r, --res <resolution>', 'Pilihan resolusi (1080P, 720P, 480P, 360P)', '720P')
    .option('--from <number>', 'Mulai dari episode ke-', '1')
    .option('--to <number>', 'Hingga episode ke-')
    .option('-o, --output <dir>', 'Direktori tujuan penyimpanan file')
    .action(async (seriesUrl, options) => {
      try {
        console.log(pc.cyan(`\n⏳ Mengambil data series: ${seriesUrl}`));
        const series = await getSeriesDetails(seriesUrl);

        console.log(pc.bold(pc.green(`✔ Series: ${series.title}`)));
        console.log(pc.dim(`Total episode: ${series.episodes.length}`));

        const fromNum = parseInt(options.from, 10) || 1;
        const toNum = options.to ? parseInt(options.to, 10) : series.episodes.length;

        const targetEpisodes = series.episodes.filter(ep => {
          const n = parseFloat(ep.number);
          return n >= fromNum && n <= toNum;
        });

        if (targetEpisodes.length === 0) {
          console.log(pc.yellow(`Tidak ada episode pada rentang ${fromNum} s/d ${toNum}.`));
          return;
        }

        console.log(pc.cyan(`\nMemulai download ${targetEpisodes.length} episode...`));
        const outDir = options.output ? path.resolve(options.output) : path.join(CONFIG.DEFAULT_DOWNLOAD_DIR, sanitizeFilename(series.title));

        for (let i = 0; i < targetEpisodes.length; i++) {
          const ep = targetEpisodes[i];
          console.log(pc.cyan(`\n[${i + 1}/${targetEpisodes.length}] Episode ${ep.number}: ${ep.title}`));
          try {
            const epData = await getEpisodeDetails(ep.url);
            const targetRes = options.res.toUpperCase();
            let servers = epData.downloads[targetRes] || epData.downloads['720P'] || epData.downloads['480P'] || epData.downloads['360P'];

            if (!servers || servers.length === 0) {
              console.log(pc.yellow(`Lewati episode ${ep.number}: link tidak tersedia.`));
              continue;
            }

            const chosen = servers.find(s => s.server === 'CLOUD') || servers.find(s => s.server === 'PRIVATE') || servers[0];
            const resolved = await resolveVideoUrl(chosen.url);
            const filename = sanitizeFilename(`${epData.title}_${targetRes}.mp4`);

            await downloadVideo(resolved.directUrl, {
              outputDir: outDir,
              filename,
              referer: chosen.url
            });
          } catch (e) {
            console.error(pc.red(`Gagal episode ${ep.number}: ${e.message}`));
          }

          if (i < targetEpisodes.length - 1) {
            await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY_MS));
          }
        }
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  // Command: direct
  program
    .command('direct <videoUrl>')
    .description('Download video dari direct URL (MP4 / WebM / Stream)')
    .option('-o, --output <filename>', 'Nama file output')
    .option('-d, --dir <dir>', 'Direktori output')
    .action(async (videoUrl, options) => {
      try {
        console.log(pc.cyan(`\n⏳ Mengambil metadata video...`));
        const resolved = await resolveVideoUrl(videoUrl);
        const outDir = options.dir ? path.resolve(options.dir) : CONFIG.DEFAULT_DOWNLOAD_DIR;
        const filename = options.output ? sanitizeFilename(options.output) : resolved.filename;

        await downloadVideo(resolved.directUrl, {
          outputDir: outDir,
          filename
        });
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  return program;
}
