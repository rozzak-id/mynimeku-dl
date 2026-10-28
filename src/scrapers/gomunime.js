import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { BaseScraper } from './baseScraper.js';

const GOMUNIME_DEFAULT_URL = process.env.GOMUNIME_BASE_URL || 'https://ww2.gomunime.org';

export class GomunimeScraper extends BaseScraper {
  constructor() {
    super({
      id: 'gomunime',
      name: 'Gomunime',
      baseUrl: GOMUNIME_DEFAULT_URL
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('gomunime');
  }

  /**
   * Search anime on Gomunime
   * @param {string} query
   */
  async search(query) {
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query.trim())}`;
    const html = await getHtml(searchUrl);
    const $ = cheerio.load(html);

    const results = [];

    $('.gm-grid2, .content-item, .item, article').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a[href*="/anime/"]').first();
      const url = $a.attr('href') || '';
      
      let title = $el.find('.title, h2, h3, h4').text().trim();
      if (!title && $a.length > 0) {
        // Gomunime raw text inside link often has: "FINISHED AIRING ★ 8.0 Naruto TV"
        const rawText = $a.text().trim();
        const cleaned = rawText
          .replace(/(?:FINISHED AIRING|CURRENTLY AIRING|UPCOMING)/gi, '')
          .replace(/★\s*[0-9.]+/g, '')
          .replace(/\b(?:TV|MOVIE|OVA|ONA)\b/gi, '')
          .trim();
        title = cleaned;
      }

      let thumbnail = $el.find('img').attr('src') || '';
      if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

      const raw = $el.text();
      const scoreMatch = raw.match(/★\s*([0-9.]+)/);
      const rating = scoreMatch ? scoreMatch[1] : '';
      const status = raw.includes('FINISHED') ? 'Completed' : (raw.includes('AIRING') ? 'On-Going' : '');

      if (title && url && !results.some(r => r.url === url)) {
        results.push({
          title,
          url,
          thumbnail,
          type: 'Series',
          status,
          rating,
          genres: [],
          provider: this.name
        });
      }
    });

    return results;
  }

  /**
   * Get latest anime updates feed from homepage
   */
  async getLatestFeed() {
    const html = await getHtml(this.baseUrl);
    const $ = cheerio.load(html);

    const feed = [];

    $('a[href*="/nonton/"], .latest-release a').each((_, el) => {
      const $a = $(el);
      const url = $a.attr('href') || '';
      const title = $a.text().trim().replace(/\s+/g, ' ');
      const epMatch = title.match(/Episode\s*(\d+)/i) || url.match(/episode-(\d+)/i);
      const epText = epMatch ? `Episode ${epMatch[1]}` : 'Episode Terbaru';

      if (url && !feed.some(f => f.episodeUrl === url)) {
        feed.push({
          title: title.replace(/Episode\s*\d+/i, '').replace(/Tonton\s*›?/i, '').trim(),
          seriesUrl: url,
          latestEpisode: epText,
          episodeUrl: url,
          thumbnail: '',
          type: 'Series',
          status: 'On-Going',
          provider: this.name
        });
      }
    });

    return feed;
  }

  /**
   * Get series details and episode list
   * @param {string} seriesUrl
   */
  async getSeriesDetails(seriesUrl) {
    const html = await getHtml(seriesUrl);
    const $ = cheerio.load(html);

    const title = $('h1').first().text().replace(/Sub Indo.*$/i, '').trim();
    const synopsis = $('.synopsis p, .entry-content p, .desc p').first().text().trim();
    let thumbnail = $('.thumb img, .poster img').first().attr('src') || '';
    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

    const episodes = [];

    $('a[href*="/nonton/"]').each((_, el) => {
      const $a = $(el);
      const epUrl = $a.attr('href') || '';
      const epText = $a.text().trim().replace(/\s+/g, ' ');

      const numMatch = epText.match(/Episode\s*(\d+)/i) || epUrl.match(/episode-(\d+)/i);
      const epNumber = numMatch ? numMatch[1] : '';

      if (epUrl && !episodes.some(e => e.url === epUrl)) {
        episodes.push({
          title: epText || `Episode ${epNumber}`,
          url: epUrl,
          number: epNumber,
          date: ''
        });
      }
    });

    return {
      title,
      url: seriesUrl,
      synopsis,
      thumbnail,
      type: 'TV',
      status: 'On-Going',
      totalEpisodes: episodes.length.toString(),
      duration: '',
      rating: '',
      genres: [],
      episodes,
      provider: this.name
    };
  }

  /**
   * Get episode details and streaming/download links
   * @param {string} episodeUrl
   */
  async getEpisodeDetails(episodeUrl) {
    const html = await getHtml(episodeUrl);
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim();
    const epNumMatch = title.match(/Episode\s*(\d+)/i) || episodeUrl.match(/episode-(\d+)/i);
    const episodeNumber = epNumMatch ? epNumMatch[1] : '';

    /** @type {Record<string, Array<{ server: string, url: string }>>} */
    const downloads = {
      '720P': [],
      '480P': []
    };

    // Find streaming players / iframes
    $('iframe[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src) {
        downloads['720P'].push({
          server: 'StreamPlayer',
          url: src
        });
      }
    });

    // Check download links if any
    $('a[href*="download"], a[href*="drive.google"], a[href*="mega.nz"]').each((_, a) => {
      const $a = $(a);
      const dlUrl = $a.attr('href') || '';
      if (dlUrl) {
        downloads['720P'].push({
          server: 'DownloadServer',
          url: dlUrl
        });
      }
    });

    const availableResolutions = Object.keys(downloads).filter(r => downloads[r].length > 0);

    return {
      title,
      url: episodeUrl,
      seriesUrl: '',
      episodeNumber,
      downloads,
      availableResolutions,
      playerServers: [],
      provider: this.name
    };
  }
}

export const gomunime = new GomunimeScraper();
