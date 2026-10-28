import path from 'node:path';
import fs from 'node:fs';
import pc from 'picocolors';
import { select, input, confirm } from '@inquirer/prompts';
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

let activeProviderId = 'all_anime'; // 'all_anime', 'all', or provider id

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
  console.log(pc.bold(pc.white('   ▶ Animeku CLI — Multi-Source Anime Streaming & Downloader')));
  console.log(pc.dim('   Cari, Nonton Bebas Iklan & Download Video Anime | v2.2.0'));

  let sourceLabel = '';
  if (activeProviderId === 'all_anime') {
    sourceLabel = pc.green('🌐 Semua Sumber Anime');
  } else if (activeProviderId === 'all') {
    sourceLabel = pc.yellow('🌟 Semua Sumber Keseluruhan');
  } else {
    const p = getProvider(activeProviderId);
    sourceLabel = p ? pc.magenta(`${p.name} [${p.category === 'mature' ? '18+ Dewasa' : 'Anime'}]`) : activeProviderId;
  }

  console.log(pc.dim('   📡 Sumber Aktif : ') + sourceLabel);
  console.log(pc.dim(`   📁 Folder Unduh : ${CONFIG.DEFAULT_DOWNLOAD_DIR}`));
  console.log(pc.cyan('  ' + '═'.repeat(63) + '\n'));
}

/**
 * Truncate long strings to prevent terminal line wrapping from corrupting Inquirer cursor
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 65) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

/**
 * Main interactive CLI loop
 */
export async function runInteractive() {
  showBanner();

  while (true) {
    try {
      console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(pc.bold(pc.yellow(' 💡 PANDUAN PENGGUNA:')));
      console.log(pc.dim(' • Ketik ') + pc.bold(pc.white('judul anime')) + pc.dim(' untuk menelusuri anime.'));
      console.log(pc.dim(' • Tempelkan ') + pc.bold(pc.white('link URL')) + pc.dim(' episode/series website manapun.'));
      console.log(pc.dim(' • Tekan ') + pc.bold(pc.green('[Enter]')) + pc.dim(' tanpa mengetik untuk membuka anime Beranda terbaru.'));
      console.log(pc.dim(' • Ketik ') + pc.bold(pc.magenta(':sumber')) + pc.dim(' untuk memilih kategori & website anime.'));
      console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      const query = await input({
        message: pc.bold('🔍 Cari anime / URL / :sumber / Beranda:')
      });

      const trimmed = query.trim();

      // Command: change provider source
      if (trimmed.toLowerCase() === ':sumber' || trimmed.toLowerCase() === ':source' || trimmed.toLowerCase() === ':s') {
        await handleSwitchSource();
        showBanner();
        continue;
      }

      // 1. Direct URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        await handleDirectUrlInput(trimmed);
      }
      // 2. Empty input -> Homepage Feed
      else if (trimmed.length === 0) {
        await handleHomepageFeed();
      }
      // 3. Keyword Search
      else {
        await handleSearchKeyword(trimmed);
      }

      console.log('\n─────────────────────────────────────────────────────────────');
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
 * Handle Switching Active Provider / Genre Segment
 */
async function handleSwitchSource() {
  const animeProviders = getProvidersByCategory('anime');
  const matureProviders = getProvidersByCategory('mature');

  const choices = [
    {
      name: `🌐 ${pc.bold(pc.green('Semua Sumber Anime'))}`,
      value: 'all_anime'
    },
    ...animeProviders.map(p => ({
      name: `📺 ${pc.bold(p.name)} ${pc.dim(`— ${p.description || p.baseUrl}`)}`,
      value: p.id
    })),
    {
      name: pc.dim('─────────────────────────────────────────────────────────────'),
      value: 'separator',
      disabled: true
    },
    ...matureProviders.map(p => ({
      name: `🔞 ${pc.bold(pc.red(p.name))} ${pc.dim(`— ${p.description}`)}`,
      value: p.id
    }))
  ];

  const selected = await select({
    message: 'Pilih Sumber Website Anime & Kategori:',
    choices,
    pageSize: 8
  });

  activeProviderId = selected;
  console.log(pc.green(`✔ Sumber berhasil diubah ke: ${activeProviderId === 'all_anime' ? 'Semua Anime Umum' : getProvider(activeProviderId)?.name}\n`));
}

/**
 * Handle Search Query
 * @param {string} keyword
 */
async function handleSearchKeyword(keyword) {
  let results = [];

  if (activeProviderId === 'all_anime') {
    console.log(pc.cyan(`\n🔍 Menelusuri "${keyword}" di seluruh website anime...`));
    results = await searchAllProviders(keyword, 'anime');
  } else if (activeProviderId === 'all') {
    console.log(pc.cyan(`\n🔍 Menelusuri "${keyword}" di semua sumber...`));
    results = await searchAllProviders(keyword, 'all');
  } else {
    const provider = getProvider(activeProviderId) || getDefaultProvider();
    console.log(pc.cyan(`\n🔍 Menelusuri "${keyword}" di ${provider.name}...`));
    results = await provider.search(keyword);
  }

  if (results.length === 0) {
    console.log(pc.yellow(`Tidak ditemukan anime dengan kata kunci "${keyword}". Coba kata kunci lain.`));
    return;
  }

  console.log(pc.green(`✔ Ditemukan ${results.length} hasil:\n`));

  const choices = results.map((item) => {
    const isOngoing = item.status?.toLowerCase().includes('ongoing') || item.status?.toLowerCase().includes('on-going');
    const updateBadge = isOngoing ? pc.bgGreen(pc.black(' ON-GOING ')) : pc.dim(`[${item.status || 'Series'}]`);
    const providerBadge = pc.cyan(`[${item.provider || 'Anime'}]`);
    const ratingBadge = item.rating ? pc.yellow(`★ ${item.rating}`) : '';

    const titleText = truncate(item.title, 45);

    return {
      name: `${providerBadge} ${pc.bold(pc.white(titleText))} ${updateBadge} ${ratingBadge}`,
      value: { url: item.url, providerId: item.provider?.toLowerCase() }
    };
  });

  choices.push({ name: pc.dim('⬅ Batalkan Pencarian'), value: 'cancel' });

  const selection = await select({
    message: 'Pilih anime untuk melihat episode:',
    choices,
    pageSize: 8
  });

  if (selection === 'cancel') return;

  await processSeriesSelection(selection.url);
}

/**
 * Handle Homepage Feed (Latest Updates)
 */
async function handleHomepageFeed() {
  const provider = activeProviderId.startsWith('all') ? getDefaultProvider() : (getProvider(activeProviderId) || getDefaultProvider());
  console.log(pc.cyan(`\n🔥 Mengambil daftar update anime terbaru dari ${provider.name}...`));

  let feed = [];
  try {
    feed = await provider.getLatestFeed();
  } catch (err) {
    console.log(pc.yellow(`Gagal memuat feed dari ${provider.name}: ${err.message}`));
    return;
  }

  if (feed.length === 0) {
    console.log(pc.yellow('Tidak dapat memuat feed beranda saat ini.'));
    return;
  }

  console.log(pc.green(`✔ Ditemukan ${feed.length} anime yang baru rilis / update:\n`));

  const choices = feed.map(item => ({
    name: `${pc.cyan(`[${item.type || 'TV'}]`)} ${pc.bold(truncate(item.title, 40))} ➔ ${pc.yellow(item.latestEpisode)} ${pc.dim(item.status ? `• ${item.status}` : '')}`,
    value: item.seriesUrl || item.episodeUrl
  }));

  choices.push({ name: pc.dim('⬅ Kembali'), value: 'cancel' });

  const chosenSeries = await select({
    message: 'Pilih anime:',
    choices,
    pageSize: 8
  });

  if (chosenSeries === 'cancel') return;

  await processSeriesSelection(chosenSeries);
}

/**
 * Process series selection (Single episode vs Batch)
 * @param {string} seriesUrl
 */
async function processSeriesSelection(seriesUrl) {
  const provider = findProviderByUrl(seriesUrl) || getProvider(activeProviderId) || getDefaultProvider();
  console.log(pc.cyan(`\n⏳ Mengambil data episode dari ${provider.name}...`));

  let series;
  try {
    series = await provider.getSeriesDetails(seriesUrl);
  } catch (err) {
    console.error(pc.red(`Gagal mengambil detail anime: ${err.message}`));
    return;
  }

  console.log(`\n📌 ${pc.bold(pc.green(series.title))} ${pc.cyan(`[${series.provider}]`)}`);
  if (series.status) console.log(pc.dim(`Status: ${series.status} | Tipe: ${series.type || '-'}`));
  if (series.genres && series.genres.length > 0) console.log(pc.dim(`Genre: ${series.genres.join(', ')}`));
  if (series.synopsis) console.log(pc.dim(`Sinopsis: ${series.synopsis.substring(0, 180)}...\n`));
  console.log(pc.dim(`Total Episode tersedia: ${series.episodes.length}\n`));

  if (series.episodes.length === 0) {
    console.log(pc.yellow('Belum ada episode yang tersedia untuk serial ini.'));
    return;
  }

  // Episode choices
  const epChoices = series.episodes.map(ep => ({
    name: `${pc.cyan(`[Ep ${ep.number}]`)} ${truncate(ep.title, 55)} ${ep.date ? pc.dim(`• ${ep.date}`) : ''}`,
    value: ep.url
  }));

  // Option for batch download
  epChoices.unshift({
    name: pc.bold(pc.yellow(`📦 Unduh Semua Episode • ${series.episodes.length} Episode`)),
    value: 'batch_all'
  });

  epChoices.push({ name: pc.dim('⬅ Kembali'), value: 'back' });

  const chosenAction = await select({
    message: 'Pilih episode yang ingin ditonton atau didownload:',
    choices: epChoices,
    pageSize: 8
  });

  if (chosenAction === 'back') return;

  if (chosenAction === 'batch_all') {
    await runBatchDownload(series.episodes, series.title, provider);
  } else {
    await processEpisodeAction(chosenAction, series.title, provider);
  }
}

/**
 * Process episode action: Nonton Langsung vs Download
 * @param {string} episodeUrl
 * @param {string} [seriesTitle]
 * @param {import('../scrapers/baseScraper.js').BaseScraper} [passedProvider]
 */
async function processEpisodeAction(episodeUrl, seriesTitle, passedProvider) {
  const provider = passedProvider || findProviderByUrl(episodeUrl) || getDefaultProvider();
  console.log(pc.cyan(`\n⏳ Mengambil daftar server & kualitas video dari ${provider.name}...`));

  let epData;
  try {
    epData = await provider.getEpisodeDetails(episodeUrl);
  } catch (err) {
    console.error(pc.red(`Gagal mengambil data episode: ${err.message}`));
    return;
  }

  console.log(`\n🎬 Episode: ${pc.bold(epData.title)} ${pc.cyan(`[${provider.name}]`)}`);

  if (!epData.availableResolutions || epData.availableResolutions.length === 0) {
    console.log(pc.yellow('Tidak ditemukan link video pada episode ini.'));
    return;
  }

  // Select resolution
  const resChoices = epData.availableResolutions.map(res => ({
    name: `${pc.bold(res)} • ${epData.downloads[res]?.length || 0} server`,
    value: res
  }));

  const selectedRes = await select({
    message: 'Pilih Kualitas / Resolusi Video:',
    choices: resChoices,
    pageSize: 8
  });

  const availableServers = epData.downloads[selectedRes] || [];

  if (availableServers.length === 0) {
    console.log(pc.yellow(`Tidak ada server tersedia untuk resolusi ${selectedRes}.`));
    return;
  }

  let targetServer = availableServers.find(s => ['CLOUD', 'PRIVATE', 'HXFILE', 'GOFILE'].includes(s.server.toUpperCase()));
  if (!targetServer) targetServer = availableServers[0];

  if (availableServers.length > 1) {
    const serverChoice = await select({
      message: `Pilih server untuk resolusi ${selectedRes}:`,
      choices: availableServers.map(s => {
        const sizeInfo = s.size ? pc.dim(` [${s.size}]`) : '';
        return {
          name: `${pc.bold(s.server)}${sizeInfo}`,
          value: s
        };
      }),
      pageSize: 8
    });
    targetServer = serverChoice;
  }

  console.log(pc.cyan(`\n🔗 Menyiapkan stream link dari server ${targetServer.server}...`));

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

  // Choose Action: Nonton Langsung vs Download
  const userAction = await select({
    message: 'Mau Nonton Langsung atau Download?',
    choices: [
      {
        name: `▶️  ${pc.bold(pc.green('Nonton Langsung'))}`,
        value: 'watch'
      },
      {
        name: `📥  ${pc.bold(pc.cyan('Download Video'))}`,
        value: 'download'
      },
      {
        name: pc.dim('⬅  Kembali ke Menu'),
        value: 'back'
      }
    ],
    pageSize: 8
  });

  if (userAction === 'back') return;

  if (userAction === 'watch') {
    await handleWatchVideo({
      title: epData.title,
      videoUrl: resolved.directUrl,
      referer: targetServer.url,
      sourceName: provider.name,
      resolution: selectedRes
    });
  } else {
    await handleDownloadWithConfirmation({
      title: epData.title,
      resolved,
      seriesTitle,
      selectedRes,
      targetServer,
      providerName: provider.name
    });
  }
}

/**
 * Handle Watch Video via local temporary ad-free mini player
 */
async function handleWatchVideo({ title, videoUrl, referer, sourceName, resolution }) {
  console.log(pc.green('\n🚀 Membuka Mini Player Bebas Iklan di Browser Anda...'));

  const player = await launchMiniPlayer({
    title,
    videoUrl,
    referer,
    sourceName,
    resolution
  });

  console.log(pc.cyan(`
╭─────────────────────────────────────────────────────────────╮
│ 🎬 ${pc.bold('MINI PLAYER BERJALAN — BEBAS IKLAN 100%')}                 │
│                                                             │
│ • URL Player : ${pc.bold(pc.yellow(player.url))}                          │
│ • Judul      : ${pc.bold(truncate(title, 40))} │
│ • Resolusi   : ${pc.bold(pc.green(resolution))}                                     │
│                                                             │
│ 💡 ${pc.dim('Player telah dibuka otomatis di browser Anda.')}            │
│    ${pc.dim('Tersedia juga tombol Download langsung di player.')}       │
╰─────────────────────────────────────────────────────────────╯`));

  await input({
    message: pc.yellow('Tekan [Enter] jika sudah selesai menonton untuk menutup player...')
  });

  player.close();
  console.log(pc.dim('Mini player telah dimatikan.'));
}

/**
 * Handle Download with explicit Y/N confirmation
 */
async function handleDownloadWithConfirmation({ title, resolved, seriesTitle, selectedRes, targetServer, providerName }) {
  const subFolder = seriesTitle ? sanitizeFilename(seriesTitle) : '';
  const outputDir = path.join(CONFIG.DEFAULT_DOWNLOAD_DIR, subFolder);

  let filename = resolved.filename;
  if (!filename || filename === 'anime_episode.mp4' || filename === 'video.mp4') {
    filename = sanitizeFilename(`${title}_${selectedRes}.mp4`);
  }

  // Display detail card
  console.log(pc.cyan(`
╭─────────────────────────────────────────────────────────────╮
│ 📥 ${pc.bold('KONFIRMASI UNDUHAN')}                                     │
│                                                             │
│ • Judul     : ${pc.bold(truncate(title, 42))} │
│ • Sumber    : ${pc.bold(providerName)} • ${pc.cyan(targetServer.server)} │
│ • Resolusi  : ${pc.bold(pc.green(selectedRes))}                                     │
│ • Folder    : ${pc.dim(truncate(outputDir, 42))} │
│ • Nama File : ${pc.yellow(truncate(filename, 42))} │
╰─────────────────────────────────────────────────────────────╯`));

  // Explicit Y/N Confirmation
  const confirmDownload = await confirm({
    message: pc.bold('Mulai download video ini sekarang?'),
    default: true
  });

  if (!confirmDownload) {
    console.log(pc.yellow('\nUnduhan dibatalkan oleh pengguna.'));
    return;
  }

  console.log(pc.green('\nMemulai proses pengunduhan...'));

  await downloadVideo(resolved.directUrl, {
    outputDir,
    filename,
    referer: resolved.referer || targetServer.url
  });
}

/**
 * Run batch download with explicit confirmation
 * @param {Array<{ number: string|number, title: string, url: string }>} episodes
 * @param {string} seriesTitle
 * @param {import('../scrapers/baseScraper.js').BaseScraper} provider
 */
async function runBatchDownload(episodes, seriesTitle, provider) {
  const resPreference = await select({
    message: 'Pilih resolusi video untuk seluruh batch:',
    choices: [
      { name: '720P', value: '720P' },
      { name: '1080P', value: '1080P' },
      { name: '480P', value: '480P' },
      { name: '360P', value: '360P' }
    ],
    pageSize: 8
  });

  const outputDir = path.join(CONFIG.DEFAULT_DOWNLOAD_DIR, sanitizeFilename(seriesTitle));

  console.log(pc.cyan(`
╭─────────────────────────────────────────────────────────────╮
│ 📦 ${pc.bold('KONFIRMASI BATCH UNDUHAN')}                               │
│                                                             │
│ • Serial    : ${pc.bold(truncate(seriesTitle, 42))} │
│ • Sumber    : ${pc.bold(provider.name)}                                  │
│ • Total     : ${pc.bold(pc.yellow(episodes.length.toString()))} Episode                              │
│ • Resolusi  : ${pc.bold(pc.green(resPreference))}                                     │
│ • Folder    : ${pc.dim(truncate(outputDir, 42))} │
╰─────────────────────────────────────────────────────────────╯`));

  const confirmBatch = await confirm({
    message: pc.bold(`Apakah Anda yakin ingin mengunduh seluruh ${episodes.length} episode?`),
    default: true
  });

  if (!confirmBatch) {
    console.log(pc.yellow('\nBatch unduhan dibatalkan.'));
    return;
  }

  console.log(pc.green(`\n🚀 Memulai antrean batch download untuk ${episodes.length} episode dari ${provider.name}...`));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    console.log(pc.bold(pc.cyan(`\n[${i + 1}/${episodes.length}] Memproses Episode ${ep.number}: ${ep.title}`)));

    try {
      const epData = await provider.getEpisodeDetails(ep.url);

      let matchedRes = resPreference;
      if (!epData.downloads[matchedRes] || epData.downloads[matchedRes].length === 0) {
        matchedRes = CONFIG.FALLBACK_RESOLUTIONS.find(r => epData.downloads[r] && epData.downloads[r].length > 0) || epData.availableResolutions?.[0];
      }

      if (!matchedRes || !epData.downloads[matchedRes]) {
        console.log(pc.yellow(`⚠ Tidak ditemukan link download untuk episode ${ep.number}`));
        failCount++;
        continue;
      }

      const servers = epData.downloads[matchedRes];
      let chosen = servers.find(s => ['CLOUD', 'PRIVATE', 'HXFILE', 'GOFILE'].includes(s.server.toUpperCase())) || servers[0];

      const resolved = await resolveVideoUrl(chosen.url, { referer: ep.url });
      const filename = sanitizeFilename(`${epData.title}_${matchedRes}.mp4`);

      await downloadVideo(resolved.directUrl, {
        outputDir,
        filename,
        referer: resolved.referer || chosen.url
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
 * Handle direct URL input (Auto detect provider & content type)
 * @param {string} targetUrl
 */
async function handleDirectUrlInput(targetUrl) {
  const provider = findProviderByUrl(targetUrl);

  if (provider) {
    console.log(pc.cyan(`\n🔍 Terdeteksi link dari provider: ${pc.bold(provider.name)}`));
    if (targetUrl.includes('/episode') || targetUrl.includes('-episode-') || targetUrl.includes('/nonton')) {
      await processEpisodeAction(targetUrl, null, provider);
      return;
    } else if (targetUrl.includes('/series/') || targetUrl.includes('/anime/')) {
      await processSeriesSelection(targetUrl);
      return;
    }
  }

  console.log(pc.cyan(`\n⏳ Mengambil metadata video langsung...`));
  try {
    const resolved = await resolveVideoUrl(targetUrl);
    
    const confirmDl = await confirm({
      message: `Download video: ${resolved.filename}?`,
      default: true
    });

    if (!confirmDl) {
      console.log(pc.yellow('Unduhan dibatalkan.'));
      return;
    }

    await downloadVideo(resolved.directUrl, {
      filename: resolved.filename,
      outputDir: CONFIG.DEFAULT_DOWNLOAD_DIR
    });
  } catch (err) {
    console.log(pc.red(`Gagal mengunduh URL: ${err.message}`));
  }
}
