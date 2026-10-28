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

    // Episode list in .episodelist or .eplister
    $('.episodelist ul li, .eplister ul li').each((_, el) => {
      const $li = $(el);
      const $a = $li.find('a').first();
      const epUrl = $a.attr('href') || '';

      // Only include valid episode links from nontonhentai.net
      if (!epUrl || !epUrl.includes('nontonhentai.net') || epUrl.includes('/genres/')) return;

      const epTitle = $li.find('h3, .playinfo h3').text().trim() || $a.text().trim().replace(/\s+/g, ' ');
      const epMeta = $li.find('.playinfo span').text().trim();

      let numMatch = epMeta.match(/eps?\s*(\d+)/i) || epTitle.match(/episode\s*(\d+)/i) || epUrl.match(/episode-(\d+)/i);
      const epNum = numMatch ? numMatch[1] : (episodes.length + 1).toString();
      const date = epMeta.includes('-') ? epMeta.split('-').slice(1).join('-').trim() : '';

      if (!episodes.some(e => e.url === epUrl)) {
        episodes.push({
          title: epTitle || `Episode ${epNum}`,
          url: epUrl,
          number: epNum,
          date
        });
      }
    });

    // Sort episodes in ascending order
    episodes.sort((a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0));

    // If single episode page
    if (episodes.length === 0) {
      episodes.push({
        title: title || 'Episode 1',
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
      '1080P': [],
      '720P': [],
      '480P': [],
      '360P': []
    };

    // 1. Parse structured download boxes (e.g. Hepidrive, Lokal)
    $('.soraddlx .soraurlx, .mctnx .soraurlx, .soraurlx').each((_, el) => {
      const resText = $(el).find('strong').text().trim().toUpperCase();
      let resKey = '720P';
      if (resText.includes('1080')) resKey = '1080P';
      else if (resText.includes('720')) resKey = '720P';
      else if (resText.includes('480')) resKey = '480P';
      else if (resText.includes('360')) resKey = '360P';

      $(el).find('a').each((_, a) => {
        const serverName = $(a).text().trim() || 'LOKAL';
        const dlUrl = $(a).attr('href');
        if (dlUrl && !downloads[resKey].some(s => s.url === dlUrl)) {
          downloads[resKey].push({
            server: serverName.toUpperCase(),
            url: dlUrl
          });
        }
      });
    });

    // 2. Generic download link fallback
    $('.download a, .link-download a, a[href*="hepidrive"], a[href*="drive.google"], a[href*="mega.nz"]').each((_, a) => {
      const dlUrl = $(a).attr('href') || '';
      if (!dlUrl) return;
      const serverName = $(a).text().trim() || 'LOKAL';
      if (!downloads['720P'].some(s => s.url === dlUrl)) {
        downloads['720P'].push({
          server: serverName.toUpperCase(),
          url: dlUrl
        });
      }
    });

    // 3. Fallback to stream embed if no direct downloads exist
    const totalFound = Object.values(downloads).reduce((acc, curr) => acc + curr.length, 0);
    if (totalFound === 0) {
      $('iframe[src]').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src && !src.includes('facebook') && !src.includes('twitter')) {
          downloads['720P'].push({
            server: 'StreamServer',
            url: src
          });
        }
      });
    }

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
