import { mynimeku, MyNimekuScraper, searchAnime, getLatestAnimeFeed, getSeriesDetails, getEpisodeDetails } from './mynimeku.js';
import { otakudesu, OtakudesuScraper } from './otakudesu.js';
import { BaseScraper } from './baseScraper.js';

export { BaseScraper, MyNimekuScraper, OtakudesuScraper };
export { searchAnime, getLatestAnimeFeed, getSeriesDetails, getEpisodeDetails };

/** @type {Map<string, BaseScraper>} */
const registry = new Map();

// Register default built-in providers
registry.set(mynimeku.id, mynimeku);
registry.set(otakudesu.id, otakudesu);

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
 * Get provider by its unique identifier (e.g. 'mynimeku', 'otakudesu')
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
 * Search anime across all registered providers in parallel
 * @param {string} query
 * @returns {Promise<Array<{
 *   title: string,
 *   url: string,
 *   thumbnail?: string,
 *   type?: string,
 *   status?: string,
 *   rating?: string,
 *   genres?: string[],
 *   provider: string
 * }>>}
 */
export async function searchAllProviders(query) {
  const providers = getAllProviders();
  const promises = providers.map(async (p) => {
    try {
      return await p.search(query);
    } catch (err) {
      // If one provider fails or times out, don't crash others
      return [];
    }
  });

  const results = await Promise.all(promises);
  return results.flat();
}
