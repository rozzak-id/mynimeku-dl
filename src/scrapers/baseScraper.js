/**
 * Base Scraper Interface for Anime Providers
 */
export class BaseScraper {
  /**
   * @param {object} options
   * @param {string} options.id - Unique provider identifier (e.g. 'mynimeku', 'otakudesu')
   * @param {string} options.name - Human-readable provider name
   * @param {string} options.baseUrl - Base website URL
   * @param {'anime'|'mature'|'global'} [options.category='anime'] - Provider category / genre segment
   * @param {string} [options.description=''] - Brief genre / provider focus description
   */
  constructor({ id, name, baseUrl, category = 'anime', description = '' }) {
    this.id = id;
    this.name = name;
    this.baseUrl = baseUrl;
    this.category = category;
    this.description = description;
  }

  /**
   * Test if a given URL belongs to this provider
   * @param {string} url
   * @returns {boolean}
   */
  canHandleUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes(this.id);
    } catch {
      return false;
    }
  }

  /**
   * Search anime by query string
   * @param {string} query
   * @returns {Promise<Array<{
   *   title: string,
   *   url: string,
   *   thumbnail?: string,
   *   type?: string,
   *   status?: string,
   *   rating?: string,
   *   genres?: string[],
   *   provider: string,
   *   category: string
   * }>>}
   */
  async search(query) {
    throw new Error(`Method 'search()' not implemented on ${this.name}`);
  }

  /**
   * Get latest anime feed from homepage
   * @returns {Promise<Array<{
   *   title: string,
   *   seriesUrl: string,
   *   latestEpisode: string,
   *   episodeUrl: string,
   *   thumbnail?: string,
   *   type?: string,
   *   status?: string,
   *   provider: string,
   *   category: string
   * }>>}
   */
  async getLatestFeed() {
    throw new Error(`Method 'getLatestFeed()' not implemented on ${this.name}`);
  }

  /**
   * Get series details and episode list
   * @param {string} url
   * @returns {Promise<{
   *   title: string,
   *   url: string,
   *   synopsis?: string,
   *   thumbnail?: string,
   *   type?: string,
   *   status?: string,
   *   totalEpisodes?: string|number,
   *   episodes: Array<{ title: string, url: string, number: string|number }>,
   *   provider: string,
   *   category: string
   * }>}
   */
  async getSeriesDetails(url) {
    throw new Error(`Method 'getSeriesDetails()' not implemented on ${this.name}`);
  }

  /**
   * Get episode details and download links
   * @param {string} url
   * @returns {Promise<{
   *   title: string,
   *   seriesTitle?: string,
   *   episodeNumber?: string|number,
   *   downloads: Record<string, Array<{ server: string, url: string }>>,
   *   availableResolutions?: string[],
   *   playerServers?: Array<{ host: string, type: string, url: string }>,
   *   provider: string,
   *   category: string
   * }>}
   */
  async getEpisodeDetails(url) {
    throw new Error(`Method 'getEpisodeDetails()' not implemented on ${this.name}`);
  }
}
