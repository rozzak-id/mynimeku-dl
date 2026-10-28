import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { BaseScraper } from './baseScraper.js';

const NONTONHENTAI_DEFAULT_URL = process.env.NONTONHENTAI_BASE_URL || 'https://nontonhentai.net';

export class NontonHentaiScraper extends BaseScraper {
  constructor() {
    super({
      id: 'nontonhentai',
      name: 'NontonHentai',
      baseUrl: NONTONHENTAI_DEFAULT_URL,
      category: 'mature',
      description: 'Khusus Dewasa 18+ Sub Indo'
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('nontonhentai.net');
  }

  /**
   * Search 18+ anime on NontonHentai
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
      const title = $el.find('.title, h2, h3').text().trim() || $a.attr('title') || '';
      let thumbnail = $el.find('img').attr('src') || '';
      if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

      const type = '18+ OVA';
      const status = $el.find('.status').text().trim() || 'Completed';

      if (title && url && !results.some(r => r.url === url)) {
        results.push({
          title,
          url,
          thumbnail,
          type,
          status,
          rating: '18+',
          genres: ['Hentai', 'Adult'],
          provider: this.name,
          category: this.category
        });
      }
    });

    return results;
  }

  /**
   * Get latest 18+ feed
   */
  async getLatestFeed() {
    const html = await getHtml(this.baseUrl);
    const $ = cheerio.load(html);

    const feed = [];

    $('article, .post-show ul li, .bsx').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a').first();
      const url = $a.attr('href') || '';
      const title = $el.find('.title, h2, h3').text().trim() || $a.attr('title') || '';
      let thumb = $el.find('img').attr('src') || '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      if (title && url && !feed.some(f => f.episodeUrl === url)) {
        feed.push({
          title,
          seriesUrl: url,
          latestEpisode: '18+ Episode',
          episodeUrl: url,
          thumbnail: thumb,
          type: '18+ OVA',
          status: 'Active',
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
    const synopsis = $('.desc p, .entry-content p').first().text().trim();
    let thumbnail = $('.thumb img, .poster img').first().attr('src') || '';
    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

    const episodes = [];

    // Check for episode links or single movie page
    $('a[href*="/nonton-"], a[href*="/episode-"], .eplister a').each((_, el) => {
      const $a = $(el);
      const epUrl = $a.attr('href') || '';
      const epTitle = $a.text().trim().replace(/\s+/g, ' ');

      if (epUrl && !episodes.some(e => e.url === epUrl)) {
        episodes.push({
          title: epTitle || 'Episode 1',
          url: epUrl,
          number: '1',
          date: ''
        });
      }
    });

    // If single episode page
    if (episodes.length === 0) {
      episodes.push({
        title: title || 'Full Episode (18+)',
        url: seriesUrl,
        number: '1',
        date: ''
      });
    }

    return {
      title,
      url: seriesUrl,
      synopsis,
      thumbnail,
      type: '18+ OVA',
      status: 'Completed',
      totalEpisodes: episodes.length.toString(),
      duration: '',
      rating: '18+',
      genres: ['Hentai', 'Adult'],
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

    /** @type {Record<string, Array<{ server: string, url: string }>>} */
    const downloads = {
      '720P': [],
      '480P': []
    };

    $('iframe[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src && !src.includes('facebook') && !src.includes('twitter')) {
        downloads['720P'].push({
          server: 'StreamServer (18+)',
          url: src
        });
      }
    });

    $('.download a, .link-download a, a[href*="drive.google"], a[href*="mega.nz"]').each((_, a) => {
      const $a = $(a);
      const dlUrl = $a.attr('href') || '';
      const text = $a.text().trim() || 'DownloadServer';
      if (dlUrl) {
        downloads['720P'].push({
          server: text,
          url: dlUrl
        });
      }
    });

    const availableResolutions = Object.keys(downloads).filter(r => downloads[r].length > 0);

    return {
      title,
      url: episodeUrl,
      seriesUrl: '',
      episodeNumber: '1',
      downloads,
      availableResolutions,
      playerServers: [],
      provider: this.name,
      category: this.category
    };
  }
}

export const nontonhentai = new NontonHentaiScraper();
