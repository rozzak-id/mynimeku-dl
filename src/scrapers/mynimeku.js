import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { CONFIG } from '../config.js';
import { BaseScraper } from './baseScraper.js';

/**
 * Search anime series by query string
 * @param {string} query
 * @returns {Promise<Array<{
 *   title: string,
 *   url: string,
 *   thumbnail: string,
 *   type: string,
 *   status: string,
 *   rating: string,
 *   genres: string[],
 *   provider: string
 * }>>}
 */
export async function searchAnime(query) {
  const searchUrl = `${CONFIG.BASE_URL}/?s=${encodeURIComponent(query.trim())}`;
  const html = await getHtml(searchUrl);
  const $ = cheerio.load(html);

  const results = [];

  $('article.mynimeku-search-feed__item').each((_, elem) => {
    const $item = $(elem);
    const $cover = $item.find('a.mynimeku-search-feed__cover');
    const url = $cover.attr('href') || '';
    const title = $cover.attr('aria-label') || $item.find('.mynimeku-search-feed__title a').text().trim() || $item.find('h2, h3').text().trim();
    let thumbnail = $cover.find('img').attr('src') || '';
    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

    const type = $item.find('.mynimeku-search-feed__type').text().trim() || '';
    const status = $item.find('.mynimeku-search-feed__status').text().trim() || '';
    const rating = $item.find('.mynimeku-search-feed__rating, .mynimeku-search-feed__score').text().trim() || '';

    const genres = [];
    $item.find('.mynimeku-search-feed__genre a, .mynimeku-search-feed__genres a').each((_, g) => {
      genres.push($(g).text().trim());
    });

    if (title && url) {
      results.push({
        title,
        url,
        thumbnail,
        type,
        status,
        rating,
        genres,
        provider: 'MyNimeku'
      });
    }
  });

  return results;
}

/**
 * Get latest update anime feed directly from homepage (YouTube-like Home feed)
 * @returns {Promise<Array<{
 *   title: string,
 *   seriesUrl: string,
 *   latestEpisode: string,
 *   episodeUrl: string,
 *   thumbnail: string,
 *   type: string,
 *   status: string,
 *   provider: string
 * }>>}
 */
export async function getLatestAnimeFeed() {
  const html = await getHtml(CONFIG.BASE_URL);
  const $ = cheerio.load(html);

  const feed = [];

  $('li, article, .item').each((_, el) => {
    const $el = $(el);
    const seriesLink = $el.find('a[href*="/series/"]');
    const episodeLink = $el.find('a[href*="/episode/"]');

    if (seriesLink.length > 0 && episodeLink.length > 0) {
      const img = $el.find('img').first();
      let title = img.attr('alt') || '';
      if (!title) {
        seriesLink.each((_, s) => {
          const t = $(s).text().trim();
          if (t && !t.includes('On-Going') && !t.includes('Completed') && !t.includes('TV') && !t.includes('BD')) {
            title = t;
          }
        });
      }

      const seriesUrl = seriesLink.first().attr('href') || '';
      const epUrl = episodeLink.first().attr('href') || '';
      
      const epText = episodeLink.first().text().trim().replace(/\s+/g, ' ');
      const epNumMatch = epText.match(/Ep\.\s*(\d+)/i) || epUrl.match(/episode-(\d+)/i);
      const episode = epNumMatch ? `Episode ${epNumMatch[1]}` : (epText || 'Episode Terbaru');

      let thumb = img.attr('data-src') || img.attr('src') || '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      const type = $el.find('.type, [class*="type"]').first().text().trim() || 'TV';
      const status = $el.find('.status, [class*="status"]').first().text().trim() || 'On-Going';

      if (title && epUrl && !feed.some(item => item.episodeUrl === epUrl)) {
        feed.push({
          title,
          seriesUrl,
          latestEpisode: episode,
          episodeUrl: epUrl,
          thumbnail: thumb,
          type,
          status,
          provider: 'MyNimeku'
        });
      }
    }
  });

  return feed;
}

/**
 * Get series full details including episode list
 * @param {string} seriesUrl
 * @returns {Promise<{
 *   title: string,
 *   url: string,
 *   synopsis: string,
 *   thumbnail: string,
 *   type: string,
 *   status: string,
 *   totalEpisodes: string,
 *   duration: string,
 *   rating: string,
 *   genres: string[],
 *   episodes: Array<{
 *     title: string,
 *     url: string,
 *     number: string,
 *     date: string
 *   }>,
 *   provider: string
 * }>}
 */
export async function getSeriesDetails(seriesUrl) {
  const html = await getHtml(seriesUrl);
  const $ = cheerio.load(html);

  const title = $('h1.komik-series-hero__title, h1.entry-title, .mynimeku-series-hero__title').first().text().trim() ||
                $('title').text().replace(/\s*-\s*MyNimeku.*$/i, '').trim();
  const synopsis = $('.komik-series-hero__synopsis, .mynimeku-series-hero__synopsis, .entry-content p, .synopsis').first().text().trim();
  
  let thumbnail = $('.komik-series-hero__poster img, .mynimeku-series-hero__poster img, .thumb img').attr('src') || '';
  if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

  let type = '';
  let status = '';
  let totalEpisodes = '';
  let duration = '';
  let rating = '';
  const genres = [];

  $('.komik-series-meta__item, .mynimeku-series-meta__item, .spe span').each((_, item) => {
    const text = $(item).text().trim();
    if (text.includes('Status:')) status = text.replace('Status:', '').trim();
    if (text.includes('Type:')) type = text.replace('Type:', '').trim();
    if (text.includes('Episodes:')) totalEpisodes = text.replace('Episodes:', '').trim();
    if (text.includes('Duration:')) duration = text.replace('Duration:', '').trim();
    if (text.includes('Score:') || text.includes('Rating:')) rating = text.replace(/Score:|Rating:/, '').trim();
  });

  $('.komik-series-genres a, .mynimeku-series-genres a, .genxed a').each((_, g) => {
    genres.push($(g).text().trim());
  });

  const episodes = [];

  // Parse episode list items
  $('a[href*="/episode/"], .komik-series-chapter-list a, .mynimeku-episode-list__item, .eplister ul li').each((_, ep) => {
    const $ep = $(ep);
    const $link = $ep.is('a') ? $ep : $ep.find('a');
    const epUrl = $link.attr('href') || '';
    if (!epUrl || !epUrl.includes('/episode/')) return;

    let epTitle = $link.find('.komik-series-chapter-list__name, .mynimeku-episode-list__title').text().trim() ||
                  $link.text().trim().replace(/\s+/g, ' ');
    const epDate = $ep.find('.komik-series-chapter-list__date, .mynimeku-episode-list__date').text().trim() || '';

    // Clean up "NEW" badges or redundant numbers
    epTitle = epTitle.replace(/\bNEW\b/gi, '').trim();

    const numMatch = epTitle.match(/Episode\s*(\d+)/i) || epUrl.match(/episode-(\d+)/i) || epTitle.match(/\b(\d+)\b/);
    const epNumber = numMatch ? numMatch[1] : (episodes.length + 1).toString();

    if (!episodes.some(e => e.url === epUrl)) {
      episodes.push({
        title: epTitle || `Episode ${epNumber}`,
        url: epUrl,
        number: epNumber,
        date: epDate
      });
    }
  });

  // Sort episodes in ascending order (Episode 1, Episode 2, ...)
  episodes.sort((a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0));

  return {
    title,
    url: seriesUrl,
    synopsis,
    thumbnail,
    type,
    status,
    totalEpisodes: episodes.length ? episodes.length.toString() : totalEpisodes,
    duration,
    rating,
    genres,
    episodes,
    provider: 'MyNimeku'
  };
}

/**
 * Get episode details including download links and servers
 * @param {string} episodeUrl
 * @returns {Promise<{
 *   title: string,
 *   url: string,
 *   seriesUrl: string,
 *   episodeNumber: string,
 *   downloads: Record<string, Array<{ server: string, url: string }>>,
 *   availableResolutions: string[],
 *   playerServers: Array<{ host: string, type: string, url: string }>,
 *   provider: string
 * }>}
 */
export async function getEpisodeDetails(episodeUrl) {
  const html = await getHtml(episodeUrl);
  const $ = cheerio.load(html);

  const title = $('h1.mynimeku-episode-head__title, h1.entry-title:not(.title), .post-title').first().text().trim() ||
                $('title').text().replace(/\s*-\s*MyNimeku.*$/i, '').trim();
  const seriesUrl = $('.mynimeku-episode-header__series-link, .breadcrumbs a[href*="/series/"], a[href*="/series/"]').attr('href') || '';
  
  const epNumMatch = title.match(/Episode\s*(\d+)/i) || episodeUrl.match(/episode-(\d+)/i);
  const episodeNumber = epNumMatch ? epNumMatch[1] : '';

  /** @type {Record<string, Array<{ server: string, url: string }>>} */
  const downloads = {};

  $('section.mynimeku-episode-downloads .mynimeku-episode-download-card').each((_, card) => {
    const $card = $(card);
    const resRaw = $card.find('.mynimeku-episode-download-card__res').text().trim().toUpperCase();
    const resolution = resRaw || 'UNKNOWN';

    if (!downloads[resolution]) {
      downloads[resolution] = [];
    }

    $card.find('.mynimeku-episode-download-card__links a').each((_, a) => {
      const $a = $(a);
      const server = $a.text().trim().toUpperCase() || 'SERVER';
      const dlUrl = $a.attr('href');
      if (dlUrl) {
        downloads[resolution].push({
          server,
          url: dlUrl
        });
      }
    });
  });

  const playerServers = [];
  $('button[data-player-url]').each((_, btn) => {
    const $b = $(btn);
    playerServers.push({
      host: $b.attr('data-player-host') || $b.text().trim(),
      type: $b.attr('data-player-type') || 'public',
      url: $b.attr('data-player-url') || ''
    });
  });

  const availableResolutions = Object.keys(downloads);

  return {
    title,
    url: episodeUrl,
    seriesUrl,
    episodeNumber,
    downloads,
    availableResolutions,
    playerServers,
    provider: 'MyNimeku'
  };
}

export class MyNimekuScraper extends BaseScraper {
  constructor() {
    super({
      id: 'mynimeku',
      name: 'MyNimeku',
      baseUrl: CONFIG.BASE_URL
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('mynimeku.com');
  }

  async search(query) {
    return searchAnime(query);
  }

  async getLatestFeed() {
    return getLatestAnimeFeed();
  }

  async getSeriesDetails(url) {
    return getSeriesDetails(url);
  }

  async getEpisodeDetails(url) {
    return getEpisodeDetails(url);
  }
}

export const mynimeku = new MyNimekuScraper();
