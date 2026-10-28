import { mynimeku, MyNimekuScraper, searchAnime, getLatestAnimeFeed, getSeriesDetails, getEpisodeDetails } from './mynimeku.js';
import { otakudesu, OtakudesuScraper } from './otakudesu.js';
import { samehadaku, SamehadakuScraper } from './samehadaku.js';
import { gomunime, GomunimeScraper } from './gomunime.js';
import { layaranime, LayaranimeScraper } from './layaranime.js';
import { nontonhentai, NontonHentaiScraper } from './nontonhentai.js';
import { BaseScraper } from './baseScraper.js';

export {
  BaseScraper,
  MyNimekuScraper,
  OtakudesuScraper,
  SamehadakuScraper,
  GomunimeScraper,
  LayaranimeScraper,
  NontonHentaiScraper,
  mynimeku,
  otakudesu,
  samehadaku,
  gomunime,
  layaranime,
  nontonhentai,
  searchAnime,
  getLatestAnimeFeed,
  getSeriesDetails,
  getEpisodeDetails
};

/** @type {Map<string, BaseScraper>} */
const registry = new Map();

// Register built-in providers
registry.set(mynimeku.id, mynimeku);
registry.set(otakudesu.id, otakudesu);
registry.set(samehadaku.id, samehadaku);
registry.set(gomunime.id, gomunime);
registry.set(layaranime.id, layaranime);
registry.set(nontonhentai.id, nontonhentai);

/**
 * Register a new anime scraper provider
 * @param {BaseScraper} provider
 */
export function registerProvider(provider) {
  if (!(provider instanceof BaseScraper)) {
    throw new Error('Provider must be an instance of BaseScraper');
  }
  registry.set(provider.id, provider);
}

/**
 * Get provider by its unique identifier
 * @param {string} id
 * @returns {BaseScraper|undefined}
 */
export function getProvider(id) {
  return registry.get(id?.toLowerCase());
}

/**
 * Get all registered providers as an array
 * @returns {BaseScraper[]}
 */
export function getAllProviders() {
  return Array.from(registry.values());
}

/**
 * Get providers filtered by category ('anime', 'mature', 'global')
 * @param {'anime'|'mature'|'global'} category
 * @returns {BaseScraper[]}
 */
export function getProvidersByCategory(category = 'anime') {
  return getAllProviders().filter(p => p.category === category);
}

/**
 * Get the default active provider (MyNimeku)
 * @returns {BaseScraper}
 */
export function getDefaultProvider() {
  return registry.get('mynimeku') || getAllProviders()[0];
}

/**
 * Automatically determine which provider can handle a given URL
 * @param {string} url
 * @returns {BaseScraper|undefined}
 */
export function findProviderByUrl(url) {
  if (!url) return undefined;
  for (const provider of registry.values()) {
    if (provider.canHandleUrl(url)) {
      return provider;
    }
  }
  return undefined;
}

/**
 * Search anime across providers in parallel with category filtering and smart sorting
 * @param {string} query
 * @param {string} [categoryFilter='anime'] - Category to search ('anime', 'mature', or 'all')
 * @returns {Promise<Array<{
 *   title: string,
 *   url: string,
 *   thumbnail?: string,
 *   type?: string,
 *   status?: string,
 *   rating?: string,
 *   genres?: string[],
 *   provider: string,
 *   category: string,
 *   isLatest?: boolean
 * }>>}
 */
export async function searchAllProviders(query, categoryFilter = 'anime') {
  let providers = getAllProviders();
  if (categoryFilter && categoryFilter !== 'all') {
    providers = providers.filter(p => p.category === categoryFilter);
  }

  const promises = providers.map(async (p) => {
    try {
      return await p.search(query);
    } catch {
      return [];
    }
  });

  const results = await Promise.all(promises);
  const flattened = results.flat();

  // Smart sort: Latest / On-Going updates on top, followed by rating
  return flattened.sort((a, b) => {
    const aOngoing = a.status?.toLowerCase().includes('ongoing') || a.status?.toLowerCase().includes('on-going') ? 1 : 0;
    const bOngoing = b.status?.toLowerCase().includes('ongoing') || b.status?.toLowerCase().includes('on-going') ? 1 : 0;
    if (bOngoing !== aOngoing) return bOngoing - aOngoing;

    const aRating = parseFloat(a.rating) || 0;
    const bRating = parseFloat(b.rating) || 0;
    return bRating - aRating;
  });
}
