import * as cheerio from 'cheerio';
import { request } from '../core/httpClient.js';
import { BaseScraper } from './baseScraper.js';

const NEKOPOI_DOMAINS = [
  process.env.NEKOPOI_BASE_URL,
  'https://nekopoi.care',
  'https://nekopoi.app',
  'https://nekopoi.stream'
].filter(Boolean);
const NEKOPOI_DEFAULT_URL = NEKOPOI_DOMAINS[0];
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

export class NekopoiScraper extends BaseScraper {
  constructor() {
    super({
      id: 'nekopoi',
      name: 'NekoPoi',
      baseUrl: NEKOPOI_DEFAULT_URL,
      category: 'mature',
      description: 'Hentai & 18+ Sub Indo'
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('nekopoi');
  }

  /**
   * Helper to fetch HTML from Nekopoi with mobile headers and domain mirror fallback
   * @param {string} url
   */
  async fetchNekopoiHtml(url) {
    let lastError = null;

    // Build URL candidates using available mirrors
    const candidates = [url];
    try {
      const parsed = new URL(url);
      for (const domain of NEKOPOI_DOMAINS) {
        const altUrl = `${domain}${parsed.pathname}${parsed.search}`;
        if (!candidates.includes(altUrl)) {
          candidates.push(altUrl);
        }
      }
    } catch {}

    for (const target of candidates) {
      try {
        const res = await request(target, {
          headers: {
            'User-Agent': MOBILE_UA,
            'Referer': ''
          }
        });
        if (res.ok) {
          return await res.text();
        }
        lastError = new Error(`Gagal memuat Nekopoi [${res.status}] dari ${target}`);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error(`Gagal memuat Nekopoi dari ${url}`);
  }

  /**
   * Search anime on Nekopoi via WP REST API & fallback
   * @param {string} query
   */
  async search(query) {
    const results = [];
    try {
      const apiUrl = `${this.baseUrl}/wp-json/wp/v2/posts?search=${encodeURIComponent(query.trim())}&per_page=20`;
      const res = await request(apiUrl, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Referer': ''
        }
      });

      if (res.ok) {
        const posts = await res.json();
        for (const post of posts) {
          const rawTitle = post.title?.rendered || '';
          const cleanTitle = cheerio.load(rawTitle).text().trim();
          const postUrl = post.link || '';

          if (cleanTitle && postUrl && !results.some(r => r.url === postUrl)) {
            results.push({
              title: cleanTitle,
              url: postUrl,
              thumbnail: '',
              type: '18+ OVA',
              status: 'Completed',
              rating: '18+',
              genres: ['Hentai', 'Adult'],
              provider: this.name,
              category: this.category
            });
          }
        }
      }
    } catch {
      // ignore API failure and fallback
    }

    // Fallback: HTML search
    if (results.length === 0) {
      try {
        const searchHtml = await this.fetchNekopoiHtml(`${this.baseUrl}/?s=${encodeURIComponent(query.trim())}&post_type=anime`);
        const $ = cheerio.load(searchHtml);

        $('article, .eropost, .result ul li').each((_, el) => {
          const $el = $(el);
          const $a = $el.find('a').first();
          const url = $a.attr('href') || '';
          const title = $el.find('h2, h3, .title').text().trim() || $a.text().trim();
          const thumb = $el.find('img').attr('src') || '';

          if (title && url && !results.some(r => r.url === url)) {
            results.push({
              title,
              url,
              thumbnail: thumb,
              type: '18+ OVA',
              status: 'Completed',
              rating: '18+',
              genres: ['Hentai', 'Adult'],
              provider: this.name,
              category: this.category
            });
          }
        });
      } catch {}
    }

    return results;
  }

  /**
   * Get latest 18+ feed
   */
  async getLatestFeed() {
    const feed = [];

    // Try WP REST API first for clean reliability
    try {
      const res = await request(`${this.baseUrl}/wp-json/wp/v2/posts?per_page=25`, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Referer': ''
        }
      });

      if (res.ok) {
        const posts = await res.json();
        for (const p of posts) {
          const rawTitle = p.title?.rendered || '';
          const cleanTitle = cheerio.load(rawTitle).text().trim();
          const url = p.link || '';

          if (cleanTitle && url && !feed.some(f => f.seriesUrl === url)) {
            feed.push({
              title: cleanTitle,
              seriesUrl: url,
              latestEpisode: '18+ Episode',
              episodeUrl: url,
              thumbnail: '',
              type: '18+ OVA',
              status: 'Active',
              provider: this.name,
              category: this.category
            });
          }
        }
      }
    } catch {}

    // Fallback: HTML homepage
    if (feed.length === 0) {
      const html = await this.fetchNekopoiHtml(this.baseUrl);
      const $ = cheerio.load(html);

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim().replace(/\s+/g, ' ');

        if (
          href.startsWith(this.baseUrl) &&
          (href.includes('/hentai/') || href.includes('-subtitle-indonesia/')) &&
          !href.includes('/hentai-list/') &&
          !href.includes('/genre-list/') &&
          !href.includes('/jadwal-new-hentai/') &&
          title.length > 3 &&
          !feed.some(f => f.seriesUrl === href)
        ) {
          feed.push({
            title,
            seriesUrl: href,
            latestEpisode: '18+ Episode',
            episodeUrl: href,
            thumbnail: '',
            type: '18+ OVA',
            status: 'Active',
            provider: this.name,
            category: this.category
          });
        }
      });
    }

    return feed;
  }

  /**
   * Get series details and episode list
   * @param {string} seriesUrl
   */
  async getSeriesDetails(seriesUrl) {
    const html = await this.fetchNekopoiHtml(seriesUrl);
    const $ = cheerio.load(html);

    const title = $('h1, title').first().text().replace(/\s*–\s*NekoPoi.*$/i, '').trim();
    const synopsis = $('.desc, .entry-content, p').first().text().trim();
    let thumbnail = $('.thumb img, .poster img, img').first().attr('src') || '';

    const episodes = [];

    // Episode list in hentai series page
    $('a[href*="-subtitle-indonesia/"], .episodelist a, ul.episodelist a').each((_, el) => {
      const $a = $(el);
      const epUrl = $a.attr('href') || '';
      if (!epUrl || !epUrl.includes('nekopoi.care') || epUrl === seriesUrl) return;

      const epTitle = $a.text().trim().replace(/\s+/g, ' ');
      if (!epTitle || epTitle.toLowerCase() === 'unduh') return;

      let numMatch = epTitle.match(/ep(?:isode)?\s*(\d+)/i) || epUrl.match(/episode-(\d+)/i);
      const epNum = numMatch ? numMatch[1] : (episodes.length + 1).toString();

      if (!episodes.some(e => e.url === epUrl)) {
        episodes.push({
          title: epTitle,
          url: epUrl,
          number: epNum,
          date: ''
        });
      }
    });

    // Sort ascending
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
    const html = await this.fetchNekopoiHtml(episodeUrl);
    const $ = cheerio.load(html);

    const title = $('h1, title').first().text().replace(/\s*–\s*NekoPoi.*$/i, '').trim();

    /** @type {Record<string, Array<{ server: string, url: string }>>} */
    const downloads = {
      '1080P': [],
      '720P': [],
      '480P': [],
      '360P': []
    };

    // 1. Parse .nk-download-row
    $('.nk-download-row').each((_, el) => {
      const resName = $(el).find('.nk-download-name').text().trim().toUpperCase();
      let resKey = '720P';
      if (resName.includes('1080')) resKey = '1080P';
      else if (resName.includes('720')) resKey = '720P';
      else if (resName.includes('480')) resKey = '480P';
      else if (resName.includes('360')) resKey = '360P';

      $(el).find('.nk-download-links a').each((_, a) => {
        const serverName = $(a).text().trim() || 'DownloadServer';
        const dlUrl = $(a).attr('href');
        if (dlUrl && !downloads[resKey].some(s => s.url === dlUrl)) {
          downloads[resKey].push({
            server: serverName.toUpperCase(),
            url: dlUrl
          });
        }
      });
    });

    // 2. Parse streampoi / playmogo embed iframes
    const streamServers = [];
    $('iframe[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('streampoi') || src.includes('playmogo')) {
        streamServers.push(src);
      }
    });

    // Try resolving streampoi stream if available
    for (const sUrl of streamServers) {
      if (sUrl.includes('streampoi')) {
        try {
          const sRes = await request(sUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Referer': this.baseUrl + '/'
            }
          });
          const sHtml = await sRes.text();
          const m = sHtml.match(/eval\((function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\))\)/);
          if (m) {
            const fn = new Function('return ' + m[1]);
            const unpacked = fn();
            const fileMatch = unpacked?.match(/file:\s*["']([^"']+)["']/i);
            if (fileMatch) {
              downloads['720P'].unshift({
                server: 'StreamPoi',
                url: fileMatch[1]
              });
            }
          }
        } catch {}
      }
    }

    const availableResolutions = Object.keys(downloads).filter(r => downloads[r].length > 0);

    return {
      title,
      url: episodeUrl,
      seriesUrl: '',
      episodeNumber: '1',
      downloads,
      availableResolutions,
      playerServers: streamServers,
      provider: this.name,
      category: this.category
    };
  }
}

export const nekopoi = new NekopoiScraper();
