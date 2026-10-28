/**
 * Animeku / MyNimeku Multi-Provider Anime Streaming & Downloader Library
 */

export { CONFIG, getDefaultDownloadDir } from './config.js';
export { request, getHtml, getHead } from './core/httpClient.js';
export { resolveVideoUrl, probeVideoMetadata, parseFilenameFromDisposition } from './core/resolver.js';
export { downloadVideo, formatBytes, sanitizeFilename } from './downloader/videoDownloader.js';
export { launchMiniPlayer } from './player/miniPlayer.js';
export { runInteractive } from './cli/interactive.js';
export { setupCommands } from './cli/commands.js';

// Providers & Multi-Source Scrapers
export {
  BaseScraper,
  MyNimekuScraper,
  OtakudesuScraper,
  SamehadakuScraper,
  GomunimeScraper,
  LayaranimeScraper,
  NontonHentaiScraper,
  registerProvider,
  getProvider,
  getAllProviders,
  getDefaultProvider,
  getProvidersByCategory,
  findProviderByUrl,
  searchAllProviders,
  searchAnime,
  getLatestAnimeFeed,
  getSeriesDetails,
  getEpisodeDetails
} from './scrapers/index.js';
export { mynimeku } from './scrapers/mynimeku.js';
export { otakudesu } from './scrapers/otakudesu.js';
export { samehadaku } from './scrapers/samehadaku.js';
export { gomunime } from './scrapers/gomunime.js';
export { layaranime } from './scrapers/layaranime.js';
export { nontonhentai } from './scrapers/nontonhentai.js';
