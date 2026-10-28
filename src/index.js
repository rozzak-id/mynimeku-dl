/**
 * Animeku / MyNimeku Multi-Provider Anime Downloader Library
 */

export { CONFIG, getDefaultDownloadDir } from './config.js';
export { request, getHtml, getHead } from './core/httpClient.js';
export { resolveVideoUrl, probeVideoMetadata, parseFilenameFromDisposition } from './core/resolver.js';
export { downloadVideo, formatBytes, sanitizeFilename } from './downloader/videoDownloader.js';
export { runInteractive } from './cli/interactive.js';
export { setupCommands } from './cli/commands.js';

// Providers & Multi-Source Scrapers
export {
  BaseScraper,
  MyNimekuScraper,
  OtakudesuScraper,
  SamehadakuScraper,
  GomunimeScraper,
  registerProvider,
  getProvider,
  getAllProviders,
  getDefaultProvider,
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
