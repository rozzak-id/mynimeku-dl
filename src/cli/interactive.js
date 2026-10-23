import path from 'node:path';
import fs from 'node:fs';
import pc from 'picocolors';
import { select, input, confirm } from '@inquirer/prompts';
import { searchAnime, getLatestAnimeFeed, getSeriesDetails, getEpisodeDetails } from '../scrapers/mynimeku.js';
import { resolveVideoUrl } from '../core/resolver.js';
import { downloadVideo, sanitizeFilename } from '../downloader/videoDownloader.js';
import { CONFIG } from '../config.js';

export function showBanner() {
  console.clear();
  console.log(pc.red(`
   ███╗   ███╗██╗   ██╗███╗   ██╗██╗███╗   ███╗███████╗██╗  ██╗
   ████╗ ████║╚██╗ ██╔╝████╗  ██║██║████╗ ████║██╔════╝██║ ██╔╝
   ██╔████╔██║ ╚████╔╝ ██╔██╗ ██║██║██╔████╔██║█████╗  █████╔╝ 
   ██║╚██╔╝██║  ╚██╔╝  ██║╚██╗██║██║██║╚██╔╝██║██╔══╝  ██╔═██╗ 
   ██║ ╚═╝ ██║   ██║   ██║ ╚████║██║██║ ╚═╝ ██║███████╗██║  ██╗
   ╚═╝     ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
`));
  console.log(pc.cyan('  ' + '═'.repeat(63)));
  console.log(pc.bold(pc.white('   ▶ MyNimeku CLI — Anime Video Search & Downloader')));
  console.log(pc.dim('   Cari judul anime & download langsung dari terminal | v1.1.0'));
  console.log(pc.dim(`   📁 Folder Unduhan: ${CONFIG.DEFAULT_DOWNLOAD_DIR}`));
  console.log(pc.cyan('  ' + '═'.repeat(63) + '\n'));
}

/**
 * Main search-first CLI loop (YouTube-style search right upon opening)
 */
export async function runInteractive() {
  showBanner();

  while (true) {
    try {
      console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(pc.bold(pc.yellow(' 💡 TIP:')) + pc.dim(' Ketik judul anime apa saja, tempelkan link URL, atau'));
      console.log(pc.dim('         tekan ') + pc.bold(pc.green('[Enter]')) + pc.dim(' tanpa mengetik untuk melihat anime terbaru di Beranda.'));
      console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      const query = await input({
        message: pc.bold('🔍 Cari anime / URL / Beranda:')
      });

      const trimmed = query.trim();

      // 1. If user pastes a direct URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        await handleDirectUrlInput(trimmed);
      }
      // 2. If user presses Enter with empty input -> Show YouTube-style Home feed (Latest Updates)
      else if (trimmed.length === 0) {
        await handleHomepageFeed();
      }
      // 3. User typed a search keyword
      else {
        await handleSearchKeyword(trimmed);
      }

      console.log('\n-------------------------------------------------------------');
      const continueSearch = await confirm({
        message: 'Mau cari anime lainnya?',
        default: true
      });

      if (!continueSearch) {
        console.log(pc.yellow('\nSampai jumpa lagi! Selamat menonton anime! 👋\n'));
        break;
      }

      showBanner();
    } catch (err) {
      if (err.name === 'ExitPromptError') {
        console.log(pc.yellow('\nKeluar dari aplikasi. Sampai jumpa! 👋\n'));
        break;
      }
      console.error(pc.red(`\n[Error] Terjadi kesalahan: ${err.message}`));
    }
  }
}

/**
 * Handle Search Query
 * @param {string} keyword
 */
async function handleSearchKeyword(keyword) {
  console.log(pc.cyan(`\n🔍 Menelusuri "${keyword}" di MyNimeku...`));
  const results = await searchAnime(keyword);

  if (results.length === 0) {
    console.log(pc.yellow(`Tidak ditemukan anime dengan kata kunci "${keyword}". Coba kata kunci lain.`));
    return;
  }

  console.log(pc.green(`✔ Ditemukan ${results.length} hasil pencarian:\n`));

  const choices = results.map((item, idx) => ({
    name: `${pc.bold(pc.white(item.title))} ${pc.magenta(`[${item.type || 'Series'}]`)} ${pc.green(`[${item.status || 'Active'}]`)} ${item.genres.length ? pc.dim(`(${item.genres.slice(0, 2).join(', ')})`) : ''}`,
    value: item.url
  }));

  choices.push({ name: pc.dim('⬅ Batalkan Pencarian'), value: 'cancel' });

  const selectedSeriesUrl = await select({
    message: 'Pilih anime:',
    choices
  });

  if (selectedSeriesUrl === 'cancel') return;

  await processSeriesSelection(selectedSeriesUrl);
}

/**
 * Handle Homepage Feed (Latest / Trending updates like YouTube Homepage)
 */
async function handleHomepageFeed() {
  console.log(pc.cyan('\n🔥 Mengambil daftar anime update terbaru dari Beranda...'));
  const feed = await getLatestAnimeFeed();

  if (feed.length === 0) {
    console.log(pc.yellow('Tidak dapat memuat feed beranda saat ini.'));
    return;
  }

  console.log(pc.green(`✔ Ditemukan ${feed.length} anime yang baru rilis / update:\n`));

  const choices = feed.map(item => ({
    name: `${pc.cyan(`[${item.type}]`)} ${pc.bold(item.title)} ➔ ${pc.yellow(item.latestEpisode)} ${pc.dim(`(${item.status})`)}`,
    value: item.seriesUrl
  }));

  choices.push({ name: pc.dim('⬅ Kembali'), value: 'cancel' });

  const chosenSeries = await select({
    message: 'Pilih anime untuk melihat episode & download:',
    choices
  });

  if (chosenSeries === 'cancel') return;

  await processSeriesSelection(chosenSeries);
}

/**
 * Process series selection (Single episode vs Batch)
 * @param {string} seriesUrl
 */
async function processSeriesSelection(seriesUrl) {
  console.log(pc.cyan('\n⏳ Mengambil data episode anime...'));
  const series = await getSeriesDetails(seriesUrl);

  console.log(`\n📌 ${pc.bold(pc.green(series.title))}`);
  if (series.status) console.log(pc.dim(`Status: ${series.status} | Tipe: ${series.type || '-'}`));
  if (series.genres.length > 0) console.log(pc.dim(`Genre: ${series.genres.join(', ')}`));
  if (series.synopsis) console.log(pc.dim(`Sinopsis: ${series.synopsis.substring(0, 180)}...\n`));
  console.log(pc.dim(`Total Episode tersedia: ${series.episodes.length}\n`));

  if (series.episodes.length === 0) {
    console.log(pc.yellow('Belum ada episode yang tersedia untuk serial ini.'));
    return;
  }

  // Episode choices
  const epChoices = series.episodes.map(ep => ({
    name: `${pc.cyan(`[Ep ${ep.number}]`)} ${ep.title} ${ep.date ? pc.dim(`(${ep.date})`) : ''}`,
    value: ep.url
  }));

  // Option for batch download
  epChoices.unshift({
    name: pc.bold(pc.yellow(`📦 [BATCH DOWNLOAD] Unduh Semua Episode (${series.episodes.length} Episode)`)),
    value: 'batch_all'
  });

  epChoices.push({ name: pc.dim('⬅ Kembali'), value: 'back' });

  const chosenAction = await select({
    message: 'Pilih episode yang ingin didownload:',
    choices: epChoices
  });

  if (chosenAction === 'back') return;

  if (chosenAction === 'batch_all') {
    await runBatchDownload(series.episodes, series.title);
  } else {
    await processEpisodeDownload(chosenAction, series.title);
  }
}

/**
 * Process single episode download
 * @param {string} episodeUrl
 * @param {string} [seriesTitle]
 */
async function processEpisodeDownload(episodeUrl, seriesTitle) {
  console.log(pc.cyan('\n⏳ Mengambil daftar link download episode...'));
  const epData = await getEpisodeDetails(episodeUrl);

  console.log(`\n🎬 Episode: ${pc.bold(epData.title)}`);

  if (epData.availableResolutions.length === 0) {
    console.log(pc.yellow('Tidak ditemukan link download pada episode ini.'));
    return;
  }

  // Select resolution
  const resChoices = epData.availableResolutions.map(res => ({
    name: `${pc.bold(res)} (${epData.downloads[res].length} server)`,
    value: res
  }));

  const selectedRes = await select({
    message: 'Pilih Resolusi Video:',
    choices: resChoices
  });

  const availableServers = epData.downloads[selectedRes];

  let targetServer = availableServers.find(s => s.server === 'CLOUD');
  if (!targetServer) targetServer = availableServers.find(s => s.server === 'PRIVATE');
  if (!targetServer) targetServer = availableServers[0];

  if (availableServers.length > 1) {
    const serverChoice = await select({
      message: `Pilih server untuk resolusi ${selectedRes}:`,
      choices: availableServers.map(s => ({
        name: `${s.server} ${s.server === 'CLOUD' || s.server === 'PRIVATE' ? pc.green('(Direct MP4 - Direkomendasikan)') : pc.yellow('(DRIVE - Butuh login)')}`,
        value: s
      }))
    });
    targetServer = serverChoice;
  }

  console.log(pc.cyan(`\n🔗 Menyelesaikan link download dari server ${targetServer.server}...`));

  let resolved;
  try {
    resolved = await resolveVideoUrl(targetServer.url);
  } catch (err) {
    console.log(pc.yellow(`Gagal dengan server ${targetServer.server}: ${err.message}`));
    const alternative = availableServers.find(s => s.url !== targetServer.url && s.server !== 'DRIVE');
    if (alternative) {
      console.log(pc.cyan(`Mencoba server alternatif: ${alternative.server}...`));
      resolved = await resolveVideoUrl(alternative.url);
    } else {
      throw err;
    }
  }

  const subFolder = seriesTitle ? sanitizeFilename(seriesTitle) : '';
  const outputDir = path.join(CONFIG.DEFAULT_DOWNLOAD_DIR, subFolder);

  let filename = resolved.filename;
  if (!filename || filename === 'anime_episode.mp4') {
    filename = sanitizeFilename(`${epData.title}_${selectedRes}.mp4`);
  }

  await downloadVideo(resolved.directUrl, {
    outputDir,
    filename,
    referer: targetServer.url
  });
}

/**
 * Run batch download
 * @param {Array<{ number: string, title: string, url: string }>} episodes
 * @param {string} seriesTitle
 */
async function runBatchDownload(episodes, seriesTitle) {
  const resPreference = await select({
    message: 'Pilih resolusi video untuk seluruh batch:',
    choices: [
      { name: '720P (Direkomendasikan - Kualitas jernih, ukuran pas)', value: '720P' },
      { name: '1080P (Full HD - Kualitas maksimal)', value: '1080P' },
      { name: '480P (Hemat kuota & cepat)', value: '480P' },
      { name: '360P (Paling hemat)', value: '360P' }
    ]
  });

  console.log(pc.green(`\n🚀 Memulai antrean batch download untuk ${episodes.length} episode...`));
  const outputDir = path.join(CONFIG.DEFAULT_DOWNLOAD_DIR, sanitizeFilename(seriesTitle));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    console.log(pc.bold(pc.cyan(`\n[${i + 1}/${episodes.length}] Memproses Episode ${ep.number}: ${ep.title}`)));

    try {
      const epData = await getEpisodeDetails(ep.url);

      let matchedRes = resPreference;
      if (!epData.downloads[matchedRes] || epData.downloads[matchedRes].length === 0) {
        matchedRes = CONFIG.FALLBACK_RESOLUTIONS.find(r => epData.downloads[r] && epData.downloads[r].length > 0) || epData.availableResolutions[0];
      }

      if (!matchedRes || !epData.downloads[matchedRes]) {
        console.log(pc.yellow(`⚠ Tidak ditemukan link download untuk episode ${ep.number}`));
        failCount++;
        continue;
      }

      const servers = epData.downloads[matchedRes];
      let chosen = servers.find(s => s.server === 'CLOUD') || servers.find(s => s.server === 'PRIVATE') || servers[0];

      const resolved = await resolveVideoUrl(chosen.url);
      const filename = sanitizeFilename(`${epData.title}_${matchedRes}.mp4`);

      await downloadVideo(resolved.directUrl, {
        outputDir,
        filename,
        referer: chosen.url
      });

      successCount++;
    } catch (err) {
      console.log(pc.red(`✖ Gagal episode ${ep.number}: ${err.message}`));
      failCount++;
    }

    if (i < episodes.length - 1) {
      await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY_MS));
    }
  }

  console.log(pc.bold(pc.green(`\n🎉 Batch download selesai! Berhasil: ${successCount}, Gagal: ${failCount}`)));
}

/**
 * Handle direct URL input (Auto detect episode / series / direct media)
 * @param {string} targetUrl
 */
async function handleDirectUrlInput(targetUrl) {
  if (targetUrl.includes('mynimeku.com/episode/')) {
    await processEpisodeDownload(targetUrl);
  } else if (targetUrl.includes('mynimeku.com/series/')) {
    await processSeriesSelection(targetUrl);
  } else {
    console.log(pc.cyan(`\n⏳ Mengambil metadata video langsung...`));
    try {
      const resolved = await resolveVideoUrl(targetUrl);
      await downloadVideo(resolved.directUrl, {
        filename: resolved.filename,
        outputDir: CONFIG.DEFAULT_DOWNLOAD_DIR
      });
    } catch (err) {
      console.log(pc.red(`Gagal mengunduh URL: ${err.message}`));
    }
  }
}
