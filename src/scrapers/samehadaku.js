import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { BaseScraper } from './baseScraper.js';

const SAMEHADAKU_DEFAULT_URL = process.env.SAMEHADAKU_BASE_URL || 'https://samehadaku.li';

export class SamehadakuScraper extends BaseScraper {
  constructor() {
    super({
      id: 'samehadaku',
      name: 'Samehadaku',
      baseUrl: SAMEHADAKU_DEFAULT_URL
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('samehadaku');
  }

  /**
   * Search anime on Samehadaku
   * @param {string} query
   */
  async search(query) {
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query.trim())}`;
    const html = await getHtml(searchUrl);
    const $ = cheerio.load(html);

    const results = [];

    // Samehadaku search results cards
    $('article, .animposx, .animepost, .post-show').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a[href*="/anime/"]').first();
      const url = $a.attr('href') || $el.find('a').first().attr('href') || '';
      const title = $el.find('.title, h2, h3').first().text().trim() || $a.attr('title') || '';
      let thumbnail = $el.find('img').first().attr('src') || '';
      if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

      const type = $el.find('.type').text().trim() || 'TV';
      const status = $el.find('.status').text().trim() || '';
      const rating = $el.find('.score, .rating').text().trim() || '';

      if (title && url && !results.some(r => r.url === url)) {
        results.push({
          title,
          url,
          thumbnail,
          type,
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

    $('.post-show ul li, .latest-post, article').each((_, el) => {
      const $el = $(el);
      const $link = $el.find('a').first();
      const url = $link.attr('href') || '';
      const title = $el.find('.entry-title, .title, h2, h3').text().trim() || $link.attr('title') || '';
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
    let targetUrl = seriesUrl;
    let html = await getHtml(targetUrl);
    let $ = cheerio.load(html);

    // If given an episode URL instead of a series page, resolve the real series URL
    if (!targetUrl.includes('/anime/')) {
      const parentSeries = $('a[href*="/anime/"]').first().attr('href');
      if (parentSeries) {
        try {
          targetUrl = parentSeries;
          html = await getHtml(targetUrl);
          $ = cheerio.load(html);
        } catch {
          // fallback to current page
        }
      }
    }

    const title = $('h1.entry-title, h1').first().text().trim();
    const synopsis = $('.entry-content p, .desc p').first().text().trim();
    let thumbnail = $('.thumb img, .poster img').first().attr('src') || '';
    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

    const episodes = [];

    // Parse all episode links on series page
    $('.lstepsiode ul li a, .episodelist ul li a, .eplister ul li a, a[href*="-episode-"]').each((_, el) => {
      const $a = $(el);
      const epUrl = $a.attr('href') || '';
      if (!epUrl || epUrl.includes('#') || epUrl.includes('respond') || epUrl.includes('/anime/')) return;

      const epTitle = $a.text().trim().replace(/\s+/g, ' ');
      if (!epTitle || /^prev|^next/i.test(epTitle)) return;

      const numMatch = epTitle.match(/Episode\s*(\d+(?:\.\d+)?)/i) || epTitle.match(/Eps?\s*(\d+(?:\.\d+)?)/i) || epUrl.match(/episode-(\d+(?:\.\d+)?)/i);
      const epNumber = numMatch ? numMatch[1] : (episodes.length + 1).toString();

      if (!episodes.some(e => e.url === epUrl)) {
        episodes.push({
          title: epTitle || `Episode ${epNumber}`,
          url: epUrl,
          number: epNumber,
          date: ''
        });
      }
    });

    // Sort ascending
    episodes.sort((a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0));

    // Fallback if single episode
    if (episodes.length === 0) {
      episodes.push({
        title: title || 'Episode 1',
        url: targetUrl,
        number: '1',
        date: ''
      });
    }

    return {
      title,
      url: targetUrl,
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
    const downloads = {};

    $('.aspd-downloads a.aspd-download, .download-eps a, .download a').each((_, a) => {
      const $a = $(a);
      const dlUrl = $a.attr('href') || '';
      const rawText = $a.text().trim().toUpperCase();

      let resolution = '720P';
      if (rawText.includes('1080P')) resolution = '1080P';
      else if (rawText.includes('720P')) resolution = '720P';
      else if (rawText.includes('480P')) resolution = '480P';
      else if (rawText.includes('360P')) resolution = '360P';

      if (!downloads[resolution]) {
        downloads[resolution] = [];
      }

      let server = 'Gofile';
      if (dlUrl.includes('gofile.io')) server = 'Gofile';
      else if (dlUrl.includes('drive.google')) server = 'GoogleDrive';
      else if (dlUrl.includes('mega.nz')) server = 'Mega';

      if (dlUrl) {
        downloads[resolution].push({
          server,
          url: dlUrl
        });
      }
    });

    const availableResolutions = Object.keys(downloads);

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

export const samehadaku = new SamehadakuScraper();
