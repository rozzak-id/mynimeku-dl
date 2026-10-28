import { Command } from 'commander';
import pc from 'picocolors';
import path from 'node:path';
import {
  getAllProviders,
  getProvider,
  getDefaultProvider,
  getProvidersByCategory,
  findProviderByUrl,
  searchAllProviders
} from '../scrapers/index.js';
import { resolveVideoUrl } from '../core/resolver.js';
import { downloadVideo, sanitizeFilename } from '../downloader/videoDownloader.js';
import { launchMiniPlayer } from '../player/miniPlayer.js';
import { CONFIG } from '../config.js';

export function setupCommands() {
  const program = new Command();

  program
    .name('animeku')
    .description('CLI tool & multi-source anime streaming & downloader with zero ads')
    .version('2.2.0');

  // Command: providers
  program
    .command('providers')
    .description('Daftar website sumber anime yang didukung')
    .action(() => {
      console.log(pc.bold(pc.cyan('\n🌐 Website Anime yang Didukung:\n')));

      console.log(pc.bold(pc.green('📺 [Kategori: Anime Umum & TV Series]')));
      getProvidersByCategory('anime').forEach((p, i) => {
        console.log(`  ${i + 1}. ${pc.bold(p.name)} ${pc.dim(`[id: ${p.id}]`)} — ${p.description || p.baseUrl}`);
        console.log(`     URL: ${pc.cyan(p.baseUrl)}`);
      });

      const mature = getProvidersByCategory('mature');
      if (mature.length > 0) {
        console.log(pc.bold(pc.red('\n🔞 [Kategori: Khusus Dewasa / 18+]')));
        mature.forEach((p, i) => {
          console.log(`  ${i + 1}. ${pc.bold(p.name)} ${pc.dim(`[id: ${p.id}]`)} — ${p.description || p.baseUrl}`);
          console.log(`     URL: ${pc.cyan(p.baseUrl)}`);
        });
      }
      console.log();
    });

  // Command: search
  program
    .command('search <keyword>')
    .description('Cari anime berdasarkan kata kunci judul')
    .option('-p, --provider <provider>', 'Pilihan website provider: mynimeku, otakudesu, samehadaku, gomunime, layaranime, nontonhentai, all', 'all_anime')
    .action(async (keyword, options) => {
      try {
        const provChoice = options.provider.toLowerCase();
        let results = [];

        if (provChoice === 'all_anime' || provChoice === 'all') {
          console.log(pc.cyan(`\n🔍 Mencari "${keyword}" di website anime...`));
          results = await searchAllProviders(keyword, provChoice === 'all' ? 'all' : 'anime');
        } else {
          const provider = getProvider(provChoice);
          if (!provider) {
            console.error(pc.red(`Provider "${options.provider}" tidak ditemukan. Gunakan: 'animeku providers'`));
            return;
          }
          console.log(pc.cyan(`\n🔍 Mencari "${keyword}" di ${provider.name}...`));
          results = await provider.search(keyword);
        }

        if (results.length === 0) {
          console.log(pc.yellow(`Tidak ditemukan hasil untuk "${keyword}".`));
          return;
        }

        console.log(pc.green(`\n✔ Ditemukan ${results.length} anime:\n`));
        results.forEach((item, i) => {
          const isOngoing = item.status?.toLowerCase().includes('ongoing') || item.status?.toLowerCase().includes('on-going');
          const badge = isOngoing ? pc.bgGreen(pc.black(' ON-GOING ')) : pc.dim(`[${item.status || '-'}]`);
          console.log(`${pc.bold(`${i + 1}. [${item.provider || 'Anime'}] ${item.title}`)} ${badge}`);
          console.log(`   URL: ${pc.cyan(item.url)}`);
          if (item.rating) console.log(`   Rating: ${pc.yellow(`★ ${item.rating}`)} | Tipe: ${item.type || '-'}`);
          if (item.genres && item.genres.length > 0) console.log(`   Genre: ${item.genres.join(', ')}`);
          console.log();
        });
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  // Command: play / watch
  program
    .command('play <episodeUrl>')
    .alias('watch')
    .description('Nonton langsung anime di App Mini Player lokal')
    .option('-r, --res <resolution>', 'Pilihan resolusi: 1080P, 720P, 480P', '720P')
    .action(async (episodeUrl, options) => {
      try {
        const provider = findProviderByUrl(episodeUrl) || getDefaultProvider();
        console.log(pc.cyan(`\n⏳ Mengambil data video dari ${provider.name}: ${episodeUrl}`));
        const epData = await provider.getEpisodeDetails(episodeUrl);

        const targetRes = options.res.toUpperCase();
        let servers = epData.downloads[targetRes] || epData.downloads['720P'] || epData.downloads['480P'] || Object.values(epData.downloads)[0];

        if (!servers || servers.length === 0) {
          throw new Error('Tidak ada stream video yang tersedia untuk episode ini.');
        }

        const chosenServer = servers[0];
        console.log(pc.cyan(`Menyiapkan stream dari server: ${chosenServer.server}`));
        const resolved = await resolveVideoUrl(chosenServer.url);

        console.log(pc.green(`\n🚀 Meluncurkan Mini Player Bebas Iklan di Browser...`));
        const player = await launchMiniPlayer({
          title: epData.title,
          videoUrl: resolved.directUrl,
          referer: chosenServer.url,
          sourceName: provider.name,
          resolution: targetRes
        });

        console.log(pc.yellow(`Player berjalan di ${player.url}. Tekan Ctrl+C untuk berhenti.`));
      } catch (err) {
        console.error(pc.red(`Error: ${err.message}`));
      }
    });

  // Command: download
  program
    .command('download <episodeUrl>')
    .description('Download video dari satu URL episode')
    .option('-r, --res <resolution>', 'Pilihan resolusi: 1080P, 720P, 480P, 360P', '720P')
    .option('-o, --output <dir>', 'Direktori tujuan penyimpanan file')
    .option('-s, --server <server>', 'Pilihan server: CLOUD, PRIVATE, HXFILE, GOFILE', 'CLOUD')
    .option('-y, --yes', 'Konfirmasi otomatis tanpa prompt Y/N')
    .action(async (episodeUrl, options) => {
      try {
        const provider = findProviderByUrl(episodeUrl) || getDefaultProvider();
        console.log(pc.cyan(`\n⏳ Mengambil data episode dari ${provider.name}: ${episodeUrl}`));
        const epData = await provider.getEpisodeDetails(episodeUrl);

        console.log(pc.green(`✔ Judul: ${epData.title} [${provider.name}]`));

        const targetRes = options.res.toUpperCase();
        let servers = epData.downloads[targetRes];

        if (!servers || servers.length === 0) {
          console.log(pc.yellow(`Resolusi ${targetRes} tidak ditemukan. Menggunakan fallback...`));
          const fallback = CONFIG.FALLBACK_RESOLUTIONS.find(r => epData.downloads[r] && epData.downloads[r].length > 0) || epData.availableResolutions?.[0];
          if (!fallback) {
            throw new Error('Tidak ada link download yang tersedia pada episode ini.');
          }
          servers = epData.downloads[fallback];
        }

        const chosenServer = servers.find(s => s.server.toUpperCase() === options.server.toUpperCase()) ||
                             servers.find(s => ['CLOUD', 'PRIVATE', 'HXFILE', 'GOFILE'].includes(s.server.toUpperCase())) ||
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
    .description('Batch download episode dari satu serial anime')
    .option('-r, --res <resolution>', 'Pilihan resolusi: 1080P, 720P, 480P, 360P', '720P')
    .option('--from <number>', 'Mulai dari episode ke-', '1')
    .option('--to <number>', 'Hingga episode ke-')
    .option('-o, --output <dir>', 'Direktori tujuan penyimpanan file')
    .action(async (seriesUrl, options) => {
      try {
        const provider = findProviderByUrl(seriesUrl) || getDefaultProvider();
        console.log(pc.cyan(`\n⏳ Mengambil data series dari ${provider.name}: ${seriesUrl}`));
        const series = await provider.getSeriesDetails(seriesUrl);

        console.log(pc.bold(pc.green(`✔ Series: ${series.title} [${provider.name}]`)));
        console.log(pc.dim(`Total episode: ${series.episodes.length}`));

        const fromNum = parseInt(options.from, 10) || 1;
        const toNum = options.to ? parseInt(options.to, 10) : series.episodes.length;

        const targetEpisodes = series.episodes.filter(ep => {
          const n = parseFloat(ep.number);
          return isNaN(n) ? true : (n >= fromNum && n <= toNum);
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
            const epData = await provider.getEpisodeDetails(ep.url);
            const targetRes = options.res.toUpperCase();
            let servers = epData.downloads[targetRes] || epData.downloads['720P'] || epData.downloads['480P'] || epData.downloads['360P'];

            if (!servers || servers.length === 0) {
              console.log(pc.yellow(`Lewati episode ${ep.number}: link tidak tersedia.`));
              continue;
            }

            const chosen = servers.find(s => ['CLOUD', 'PRIVATE', 'HXFILE', 'GOFILE'].includes(s.server.toUpperCase())) || servers[0];
            const resolved = await resolveVideoUrl(chosen.url);
            const filename = sanitizeFilename(`${epData.title}_${targetRes}.mp4`);

            await downloadVideo(resolved.directUrl, {
              outputDir,
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
    .description('Download video dari direct URL')
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
