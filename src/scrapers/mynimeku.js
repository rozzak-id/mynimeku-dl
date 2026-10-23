import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { CONFIG } from '../config.js';

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
 *   genres: string[]
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
        genres
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
 *   status: string
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

      const fullText = $el.text();
      const status = fullText.includes('Completed') ? 'Completed' : (fullText.includes('On-Going') ? 'On-Going' : '');
      const type = fullText.includes('TV') ? 'TV' : (fullText.includes('ONA') ? 'ONA' : (fullText.includes('OVA') ? 'OVA' : (fullText.includes('BD') ? 'BD' : 'Anime')));

      if (title && seriesUrl && !feed.some(item => item.seriesUrl === seriesUrl)) {
        feed.push({
          title,
          seriesUrl,
          latestEpisode: episode,
          episodeUrl: epUrl,
          thumbnail: thumb,
          type,
          status
        });
      }
    }
  });

  return feed;
}

/**
 * Get series details and all available episodes
 * @param {string} seriesUrl
 * @returns {Promise<{
 *   title: string,
 *   url: string,
 *   thumbnail: string,
 *   synopsis: string,
 *   status: string,
 *   type: string,
 *   genres: string[],
 *   episodes: Array<{
 *     number: string,
 *     title: string,
 *     url: string,
 *     date: string
 *   }>
 * }>}
 */
export async function getSeriesDetails(seriesUrl) {
  const html = await getHtml(seriesUrl);
  const $ = cheerio.load(html);

  const title = $('h1.komik-series-header__title, h1.entry-title, h1').first().text().trim();
  let thumbnail = $('.komik-series-header__cover img, .series-thumb img').first().attr('src') || '';
  if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

  const synopsis = $('.komik-series-desc__text, .series-synopsis, .entry-content').first().text().trim();

  // Extract metadata info
  let status = '';
  let type = '';
  const genres = [];

  $('.komik-series-header__meta-item, .series-meta-item').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('Status:')) status = text.replace('Status:', '').trim();
    if (text.includes('Type:')) type = text.replace('Type:', '').trim();
  });

  $('a[href*="/genre/"]').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  // Extract episodes list
  const episodes = [];
  $('a.komik-series-chapter-item').each((_, elem) => {
    const $item = $(elem);
    const url = $item.attr('href') || '';
    const number = $item.attr('data-episode-number') || $item.find('.komik-series-chapter-item__num').text().trim();
    const epTitle = $item.find('.komik-series-chapter-item__title').text().trim() || `Episode ${number}`;
    const date = $item.find('.komik-series-chapter-item__date').text().trim();

    if (url) {
      episodes.push({
        number,
        title: epTitle,
        url,
        date
      });
    }
  });

  // If no chapter items found, fallback to searching episode links
  if (episodes.length === 0) {
    $('a[href*="/episode/"]').each((_, elem) => {
      const url = $(elem).attr('href') || '';
      const text = $(elem).text().trim();
      const match = url.match(/episode-(\d+)/i) || text.match(/(?:ep|episode)\.?\s*(\d+)/i);
      const number = match ? match[1] : '';
      if (url && !episodes.some(e => e.url === url)) {
        episodes.push({
          number,
          title: text || `Episode ${number}`,
          url,
          date: ''
        });
      }
    });
  }

  // Sort episodes in ascending order (Ep 01 -> Ep N)
  episodes.sort((a, b) => {
    const numA = parseFloat(a.number) || 0;
    const numB = parseFloat(b.number) || 0;
    return numA - numB;
  });

  return {
    title,
    url: seriesUrl,
    thumbnail,
    synopsis,
    status,
    type,
    genres,
    episodes
  };
}

/**
 * Get episode details including download links and servers grouped by resolution
 * @param {string} episodeUrl
 * @returns {Promise<{
 *   title: string,
 *   url: string,
 *   seriesUrl: string,
 *   episodeNumber: string,
 *   downloads: Record<string, Array<{ server: string, url: string }>>,
 *   availableResolutions: string[]
 * }>}
 */
export async function getEpisodeDetails(episodeUrl) {
  const html = await getHtml(episodeUrl);
  const $ = cheerio.load(html);

  // Extract accurate episode title
  let title = '';
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) {
    title = ogTitle.replace(/\s*-\s*MyNimeku.*$/i, '').trim();
  }
  if (!title) {
    const docTitle = $('title').text().trim();
    if (docTitle) {
      title = docTitle.replace(/\s*-\s*MyNimeku.*$/i, '').trim();
    }
  }
  if (!title) {
    $('h1').each((_, el) => {
      const t = $(el).text().trim();
      if (t && !/^mynimeku$/i.test(t) && !title) {
        title = t;
      }
    });
  }
  if (!title) {
    title = $('h1').first().text().trim() || 'Episode';
  }

  const seriesUrl = $('a[href*="/series/"]').first().attr('href') || '';

  const numMatch = episodeUrl.match(/episode-(\d+)/i) || title.match(/Episode\s*(\d+)/i);
  const episodeNumber = numMatch ? numMatch[1] : '';

  /** @type {Record<string, Array<{ server: string, url: string }>>} */
  const downloads = {};

  // Parse download cards
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

  // Extract player server buttons if user wants streaming URLs
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
    playerServers
  };
}
