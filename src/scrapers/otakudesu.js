import * as cheerio from 'cheerio';
import { getHtml } from '../core/httpClient.js';
import { BaseScraper } from './baseScraper.js';

const OTAKUDESU_DEFAULT_URL = process.env.OTAKUDESU_BASE_URL || 'https://otakudesu.blog';

export class OtakudesuScraper extends BaseScraper {
  constructor() {
    super({
      id: 'otakudesu',
      name: 'Otakudesu',
      baseUrl: OTAKUDESU_DEFAULT_URL
    });
  }

  canHandleUrl(url) {
    if (!url) return false;
    return url.includes('otakudesu');
  }

  /**
   * Search anime on Otakudesu
   * @param {string} query
   */
  async search(query) {
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query.trim())}&post_type=anime`;
    const html = await getHtml(searchUrl);
    const $ = cheerio.load(html);

    const results = [];

    $('ul.chivsrc li').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('h2 a');
      const title = $a.text().trim();
      const url = $a.attr('href') || '';
      let thumbnail = $el.find('img').attr('src') || '';
      if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

      const set = $el.find('.set').text().trim();
      const genresMatch = set.match(/Genres\s*:\s*([^S]+?)(?=Status|$)/i);
      const statusMatch = set.match(/Status\s*:\s*([^R]+?)(?=Rating|$)/i);
      const ratingMatch = set.match(/Rating\s*:\s*([0-9.]+)/i);

      const genres = genresMatch ? genresMatch[1].split(',').map(g => g.trim()).filter(Boolean) : [];
      const status = statusMatch ? statusMatch[1].trim() : '';
      const rating = ratingMatch ? ratingMatch[1].trim() : '';

      if (title && url) {
        results.push({
          title,
          url,
          thumbnail,
          type: 'Series',
          status,
          rating,
          genres,
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

    $('.venz ul li').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.thumbz h2, .jdlflm').text().trim();
      const epText = $el.find('.epz').text().trim();
      const url = $el.find('.thumb a').attr('href') || $el.find('a').attr('href') || '';
      let thumb = $el.find('.thumbz img, img').attr('src') || '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      if (title && url) {
        feed.push({
          title,
          seriesUrl: url,
          latestEpisode: epText || 'Episode Terbaru',
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
    if (targetUrl.includes('/episode/')) {
      const parentSeries = $('.flir a[href*="/anime/"], a[href*="/anime/"]').first().attr('href');
      if (parentSeries) {
        try {
          targetUrl = parentSeries;
          html = await getHtml(targetUrl);
          $ = cheerio.load(html);
        } catch {
          // fallback
        }
      }
    }

    const title = $('h1.entry-title, .jdlflm, h1').first().text().trim();
    const synopsis = $('.sinopc p').text().trim();
    let thumbnail = $('.fotoanime img').attr('src') || '';
    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;

    let type = 'TV';
    let status = '';
    let totalEpisodes = '';
    let duration = '';
    let rating = '';
    const genres = [];

    $('.infozin .infozingle p').each((_, p) => {
      const text = $(p).text().trim();
      if (text.includes('Status:')) status = text.replace('Status:', '').trim();
      if (text.includes('Tipe:')) type = text.replace('Tipe:', '').trim();
      if (text.includes('Total Episode:')) totalEpisodes = text.replace('Total Episode:', '').trim();
      if (text.includes('Durasi:')) duration = text.replace('Durasi:', '').trim();
      if (text.includes('Skor:')) rating = text.replace('Skor:', '').trim();
      if (text.includes('Genre:')) {
        $(p).find('a').each((_, g) => genres.push($(g).text().trim()));
      }
    });

    const episodes = [];

    $('.episodelist ul li').each((_, ep) => {
      const $ep = $(ep);
      const $a = $ep.find('a');
      const epUrl = $a.attr('href') || '';
      const epTitle = $a.text().trim();
      const epDate = $ep.find('.zeebr').text().trim();

      // Skip batch container if user is looking for single episodes
      if (epUrl && !epTitle.toLowerCase().includes('batch') && epUrl.includes('/episode/')) {
        const numMatch = epTitle.match(/Episode\s*(\d+(?:\.\d+)?)/i) || epUrl.match(/episode-(\d+(?:\.\d+)?)/i);
        const epNumber = numMatch ? numMatch[1] : (epTitle || (episodes.length + 1).toString());

        episodes.push({
          title: epTitle,
          url: epUrl,
          number: epNumber,
          date: epDate
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
      type,
      status,
      totalEpisodes: episodes.length ? episodes.length.toString() : totalEpisodes,
      duration,
      rating,
      genres,
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

    const title = $('h1.posttl, h1.entry-title, h1').first().text().trim();
    const seriesUrl = $('.flir a[href*="/anime/"]').attr('href') || '';
    const epNumMatch = title.match(/Episode\s*(\d+)/i) || episodeUrl.match(/episode-(\d+)/i);
    const episodeNumber = epNumMatch ? epNumMatch[1] : '';

    /** @type {Record<string, Array<{ server: string, url: string, size?: string }>>} */
    const downloads = {};

    $('.download ul li').each((_, li) => {
      const $li = $(li);
      const rawRes = $li.find('strong').text().trim();
      const size = $li.find('i').text().trim();

      // Normalize resolution: e.g. "Mp4 720p" -> "720P", "Mp4 1080p" -> "1080P"
      let resolution = '720P';
      if (/1080p?/i.test(rawRes)) resolution = '1080P';
      else if (/720p?/i.test(rawRes)) resolution = '720P';
      else if (/480p?/i.test(rawRes)) resolution = '480P';
      else if (/360p?/i.test(rawRes)) resolution = '360P';
      else resolution = rawRes.toUpperCase() || 'UNKNOWN';

      if (!downloads[resolution]) {
        downloads[resolution] = [];
      }

      $li.find('a').each((_, a) => {
        const $a = $(a);
        const server = $a.text().trim() || 'SERVER';
        const dlUrl = $a.attr('href') || '';
        if (dlUrl) {
          downloads[resolution].push({
            server,
            url: dlUrl,
            size
          });
        }
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
      playerServers: [],
      provider: this.name
    };
  }
}

export const otakudesu = new OtakudesuScraper();
