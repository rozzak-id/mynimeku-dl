import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { BaseScraper } from './baseScraper.js';

const LAYARANIME_DEFAULT_URL = process.env.LAYARANIME_BASE_URL || 'https://layaranime.net';

export class LayaranimeScraper extends BaseScraper {
  constructor() {
    super({
      id: 'layaranime',
      name: 'LayarAnime',
      baseUrl: LAYARANIME_DEFAULT_URL,
      category: 'anime',
      description: 'Streaming & Download Anime Sub Indo'
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('layaranime.net');
  }

  /**
   * Search anime on LayarAnime
   * @param {string} query
   */
  async search(query) {
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query.trim())}`;
    const html = await getHtml(searchUrl);
    const $ = cheerio.load(html);

    const results = [];

    $('article, .animposx, .animepost, .bsx').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a').first();
      let url = $a.attr('href') || '';
      if (url.startsWith('/')) url = `${this.baseUrl}${url}`;

      const title = $el.find('.title, h2, h3').text().trim() || $a.attr('title') || '';
      let thumbnail = $el.find('img').attr('src') || '';
      if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

      const type = $el.find('.type').text().trim() || 'TV';
      const status = $el.find('.status').text().trim() || '';
      const rating = $el.find('.rating, .score').text().trim() || '';

      if (title && url && !results.some(r => r.url === url)) {
        results.push({
          title,
          url,
          thumbnail,
          type,
          status,
          rating,
          genres: [],
          provider: this.name,
          category: this.category
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

    $('.latest, .post-show, article').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a').first();
      let url = $a.attr('href') || '';
      if (url.startsWith('/')) url = `${this.baseUrl}${url}`;

      const title = $el.find('.title, h2, h3').text().trim() || $a.attr('title') || '';
      let thumb = $el.find('img').attr('src') || '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      const epMatch = title.match(/Episode\s*(\d+)/i) || url.match(/episode-(\d+)/i);
      const epText = epMatch ? `Episode ${epMatch[1]}` : 'Episode Terbaru';

      if (title && url && !feed.some(f => f.episodeUrl === url)) {
        feed.push({
          title,
          seriesUrl: url,
          latestEpisode: epText,
          episodeUrl: url,
          thumbnail: thumb,
          type: 'Series',
          status: 'On-Going',
          provider: this.name,
          category: this.category
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

    const title = $('h1.entry-title, h1').first().text().trim();
    const synopsis = $('.desc p, .entry-content p, .sinopc p').first().text().trim();
    let thumbnail = $('.thumb img, .poster img').first().attr('src') || '';
    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

    const episodes = [];

    $('a[href*="/episode-"], a[href*="/nonton-"]').each((_, el) => {
      const $a = $(el);
      let epUrl = $a.attr('href') || '';
      if (epUrl.startsWith('/')) epUrl = `${this.baseUrl}${epUrl}`;

      const epTitle = $a.text().trim().replace(/\s+/g, ' ');
      const numMatch = epTitle.match(/Episode\s*(\d+)/i) || epUrl.match(/episode-(\d+)/i);
      const epNumber = numMatch ? numMatch[1] : '';

      if (epUrl && !episodes.some(e => e.url === epUrl)) {
        episodes.push({
          title: epTitle || `Episode ${epNumber}`,
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
      provider: this.name,
      category: this.category
    };
  }

  /**
   * Get episode details and download links
   * @param {string} episodeUrl
   */
  async getEpisodeDetails(episodeUrl) {
    const html = await getHtml(episodeUrl);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1').first().text().trim();
    const epNumMatch = title.match(/Episode\s*(\d+)/i) || episodeUrl.match(/episode-(\d+)/i);
    const episodeNumber = epNumMatch ? epNumMatch[1] : '';

    /** @type {Record<string, Array<{ server: string, url: string }>>} */
    const downloads = {
      '720P': [],
      '480P': []
    };

    $('iframe[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src) {
        downloads['720P'].push({
          server: 'StreamServer',
          url: src
        });
      }
    });

    $('.download a, .link-download a, a[href*="drive.google"], a[href*="gofile.io"]').each((_, a) => {
      const $a = $(a);
      const dlUrl = $a.attr('href') || '';
      const text = $a.text().trim();
      let res = '720P';
      if (text.includes('1080')) res = '1080P';
      else if (text.includes('480')) res = '480P';
      else if (text.includes('360')) res = '360P';

      if (!downloads[res]) downloads[res] = [];
      if (dlUrl) {
        downloads[res].push({
          server: text || 'DownloadServer',
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
      provider: this.name,
      category: this.category
    };
  }
}

export const layaranime = new LayaranimeScraper();
