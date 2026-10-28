import path from 'node:path';
import fs from 'node:fs';
import pc from 'picocolors';
import { select, input, confirm } from '@inquirer/prompts';
import {
  getAllProviders,
  getProvider,
  getDefaultProvider,
  findProviderByUrl,
  searchAllProviders
} from '../scrapers/index.js';
import { resolveVideoUrl } from '../core/resolver.js';
import { downloadVideo, sanitizeFilename } from '../downloader/videoDownloader.js';
import { CONFIG } from '../config.js';

let activeProviderId = 'all'; // 'all' (Multi-Source) or provider id like 'mynimeku', 'otakudesu'

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
  console.log(pc.bold(pc.white('   ▶ MyNimeku Multi-Source Anime Downloader & Scraper')));
  console.log(pc.dim('   Cari & download anime dari berbagai website sekaligus | v2.0.0'));
  
  const providers = getAllProviders();
  const providerNames = providers.map(p => p.name).join(', ');
  const currentName = activeProviderId === 'all' 
    ? pc.green(`🌐 Semua Sumber (${providerNames})`)
    : pc.magenta(getProvider(activeProviderId)?.name || activeProviderId);

  console.log(pc.dim('   📡 Sumber Aktif : ') + currentName);
  console.log(pc.dim(`   📁 Folder Unduh : ${CONFIG.DEFAULT_DOWNLOAD_DIR}`));
  console.log(pc.cyan('  ' + '═'.repeat(63) + '\n'));
}

/**
 * Main search-first CLI loop
 */
export async function runInteractive() {
  showBanner();

  while (true) {
    try {
      console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(pc.bold(pc.yellow(' 💡 PETUNJUK:')));
      console.log(pc.dim(' • Ketik ') + pc.bold(pc.white('judul anime')) + pc.dim(' untuk mencari di website anime.'));
      console.log(pc.dim(' • Tempelkan ') + pc.bold(pc.white('link URL')) + pc.dim(' (MyNimeku, Otakudesu, direct video).'));
      console.log(pc.dim(' • Tekan ') + pc.bold(pc.green('[Enter]')) + pc.dim(' tanpa mengetik untuk melihat anime terbaru di Beranda.'));
      console.log(pc.dim(' • Ketik ') + pc.bold(pc.magenta(':sumber')) + pc.dim(' atau ') + pc.bold(pc.magenta(':source')) + pc.dim(' untuk ganti website anime.'));
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
 * Handle Switching Active Provider
 */
async function handleSwitchSource() {
  const providers = getAllProviders();
  const choices = [
    {
      name: `🌐 ${pc.bold('Semua Sumber Sekaligus')} ${pc.dim('(Cari di semua website bersamaan - Rekomendasi)')}`,
      value: 'all'
    },
    ...providers.map(p => ({
      name: `📌 ${pc.bold(p.name)} ${pc.dim(`(${p.baseUrl})`)}`,
      value: p.id
    }))
  ];

  const selected = await select({
    message: 'Pilih Sumber Website Anime:',
    choices
  });

  activeProviderId = selected;
  console.log(pc.green(`✔ Sumber berhasil diubah ke: ${activeProviderId === 'all' ? 'Semua Sumber' : getProvider(activeProviderId).name}\n`));
}

/**
 * Handle Search Query
 * @param {string} keyword
 */
async function handleSearchKeyword(keyword) {
  let results = [];

  if (activeProviderId === 'all') {
    console.log(pc.cyan(`\n🔍 Menelusuri "${keyword}" di semua website...`));
    results = await searchAllProviders(keyword);
  } else {
    const provider = getProvider(activeProviderId) || getDefaultProvider();
    console.log(pc.cyan(`\n🔍 Menelusuri "${keyword}" di ${provider.name}...`));
    results = await provider.search(keyword);
  }

  if (results.length === 0) {
    console.log(pc.yellow(`Tidak ditemukan anime dengan kata kunci "${keyword}". Coba kata kunci lain.`));
    return;
  }

  console.log(pc.green(`✔ Ditemukan ${results.length} hasil pencarian:\n`));

  const choices = results.map((item) => {
    const providerBadge = pc.cyan(`[${item.provider || 'Anime'}]`);
    const typeBadge = item.type ? pc.magenta(`[${item.type}]`) : '';
    const statusBadge = item.status ? pc.green(`[${item.status}]`) : '';
    const genreText = item.genres && item.genres.length > 0 ? pc.dim(`(${item.genres.slice(0, 2).join(', ')})`) : '';

    return {
      name: `${providerBadge} ${pc.bold(pc.white(item.title))} ${typeBadge} ${statusBadge} ${genreText}`,
      value: { url: item.url, providerId: item.provider?.toLowerCase() }
    };
  });

  choices.push({ name: pc.dim('⬅ Batalkan Pencarian'), value: 'cancel' });

  const selection = await select({
    message: 'Pilih anime:',
    choices
  });

  if (selection === 'cancel') return;

  await processSeriesSelection(selection.url);
}

/**
 * Handle Homepage Feed (Latest Updates)
 */
async function handleHomepageFeed() {
  const provider = activeProviderId === 'all' ? getDefaultProvider() : (getProvider(activeProviderId) || getDefaultProvider());
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
    name: `${pc.cyan(`[${item.type || 'TV'}]`)} ${pc.bold(item.title)} ➔ ${pc.yellow(item.latestEpisode)} ${pc.dim(`(${item.status || 'Active'})`)}`,
    value: item.seriesUrl || item.episodeUrl
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
    await runBatchDownload(series.episodes, series.title, provider);
  } else {
    await processEpisodeDownload(chosenAction, series.title, provider);
  }
}

/**
 * Process single episode download
 * @param {string} episodeUrl
 * @param {string} [seriesTitle]
 * @param {import('../scrapers/baseScraper.js').BaseScraper} [passedProvider]
 */
async function processEpisodeDownload(episodeUrl, seriesTitle, passedProvider) {
  const provider = passedProvider || findProviderByUrl(episodeUrl) || getDefaultProvider();
  console.log(pc.cyan(`\n⏳ Mengambil daftar link download dari ${provider.name}...`));

  let epData;
  try {
    epData = await provider.getEpisodeDetails(episodeUrl);
  } catch (err) {
    console.error(pc.red(`Gagal mengambil link download: ${err.message}`));
    return;
  }

  console.log(`\n🎬 Episode: ${pc.bold(epData.title)} ${pc.cyan(`[${provider.name}]`)}`);

  if (!epData.availableResolutions || epData.availableResolutions.length === 0) {
    console.log(pc.yellow('Tidak ditemukan link download pada episode ini.'));
    return;
  }

  // Select resolution
  const resChoices = epData.availableResolutions.map(res => ({
    name: `${pc.bold(res)} (${epData.downloads[res]?.length || 0} server)`,
    value: res
  }));

  const selectedRes = await select({
    message: 'Pilih Resolusi Video:',
    choices: resChoices
  });

  const availableServers = epData.downloads[selectedRes] || [];

  if (availableServers.length === 0) {
    console.log(pc.yellow(`Tidak ada server tersedia untuk resolusi ${selectedRes}.`));
    return;
  }

  let targetServer = availableServers.find(s => s.server.toUpperCase() === 'CLOUD');
  if (!targetServer) targetServer = availableServers.find(s => s.server.toUpperCase() === 'PRIVATE');
  if (!targetServer) targetServer = availableServers.find(s => s.server.toUpperCase() === 'HXFILE');
  if (!targetServer) targetServer = availableServers[0];

  if (availableServers.length > 1) {
    const serverChoice = await select({
      message: `Pilih server untuk resolusi ${selectedRes}:`,
      choices: availableServers.map(s => {
        const isRecommended = ['CLOUD', 'PRIVATE', 'HXFILE', 'ZIPPY', 'RACATY'].includes(s.server.toUpperCase());
        const badge = isRecommended ? pc.green('(Direct / Rekomendasi)') : pc.yellow('(External)');
        const sizeInfo = s.size ? pc.dim(` [${s.size}]`) : '';
        return {
          name: `${pc.bold(s.server)}${sizeInfo} ${badge}`,
          value: s
        };
      })
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
  if (!filename || filename === 'anime_episode.mp4' || filename === 'video.mp4') {
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
 * @param {Array<{ number: string|number, title: string, url: string }>} episodes
 * @param {string} seriesTitle
 * @param {import('../scrapers/baseScraper.js').BaseScraper} provider
 */
async function runBatchDownload(episodes, seriesTitle, provider) {
  const resPreference = await select({
    message: 'Pilih resolusi video untuk seluruh batch:',
    choices: [
      { name: '720P (Direkomendasikan - Kualitas jernih, ukuran pas)', value: '720P' },
      { name: '1080P (Full HD - Kualitas maksimal)', value: '1080P' },
      { name: '480P (Hemat kuota & cepat)', value: '480P' },
      { name: '360P (Paling hemat)', value: '360P' }
    ]
  });

  console.log(pc.green(`\n🚀 Memulai antrean batch download untuk ${episodes.length} episode dari ${provider.name}...`));
  const outputDir = path.join(CONFIG.DEFAULT_DOWNLOAD_DIR, sanitizeFilename(seriesTitle));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    console.log(pc.bold(pc.cyan(`\n[${i + 1}/${episodes.length}] Memproses Episode ${ep.number}: ${ep.title}`)));

    try {
      const epData = await provider.getEpisodeDetails(ep.url);

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
      let chosen = servers.find(s => s.server === 'CLOUD') || 
                   servers.find(s => s.server === 'PRIVATE') || 
                   servers.find(s => s.server.toUpperCase() === 'HXFILE') ||
                   servers[0];

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
 * Handle direct URL input (Auto detect provider & content type)
 * @param {string} targetUrl
 */
async function handleDirectUrlInput(targetUrl) {
  const provider = findProviderByUrl(targetUrl);

  if (provider) {
    console.log(pc.cyan(`\n🔍 Terdeteksi link dari provider: ${pc.bold(provider.name)}`));
    if (targetUrl.includes('/episode/') || targetUrl.includes('-episode-')) {
      await processEpisodeDownload(targetUrl, null, provider);
      return;
    } else if (targetUrl.includes('/series/') || targetUrl.includes('/anime/')) {
      await processSeriesSelection(targetUrl);
      return;
    }
  }

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
