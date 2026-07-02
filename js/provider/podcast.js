/* global getParameterByName axios localStorage angular */
// eslint-disable-next-line no-unused-vars
class podcast {
  static RSS_API = 'https://itunes.apple.com';
  static LOOKUP_API = 'https://itunes.apple.com/lookup';

  static GENRES = [
    { id: '26', name: '全部' },

    // 热门
    { id: '1318', name: '科技' },
    { id: '1324', name: '社会与文化' },
    { id: '1489', name: '新闻' },
    { id: '1304', name: '教育' },
    { id: '1321', name: '商务' },

    // 娱乐
    { id: '1310', name: '音乐' },
    { id: '1309', name: '电视与电影' },
    { id: '1303', name: '喜剧' },
    { id: '1301', name: '艺术' },
    { id: '1502', name: '休闲' },

    // 知识
    { id: '1533', name: '科学' },
    { id: '1487', name: '历史' },

    // 生活
    { id: '1512', name: '健康与健身' },
    { id: '1545', name: '体育' },
    { id: '1305', name: '儿童与家庭' },

    // 小众
    { id: '1488', name: '犯罪纪实' },
    { id: '1483', name: '小说' },
    { id: '1314', name: '宗教与心灵' },
  ];

  static _chartCache = {};
  static _chartListCache = {};

  /** 支持的国家/地区（iTunes Storefront） */
  static COUNTRIES = [
    // 中文
    { code: 'cn', name: '中国' },
    { code: 'tw', name: '台湾' },
    { code: 'hk', name: '香港' },

    // 东亚
    { code: 'jp', name: '日本' },
    { code: 'kr', name: '韩国' },

    // 英语
    { code: 'us', name: '美国' },
    { code: 'gb', name: '英国' },
    { code: 'ca', name: '加拿大' },
    { code: 'au', name: '澳大利亚' },

    // 欧洲
    { code: 'de', name: '德国' },
    { code: 'fr', name: '法国' },
    { code: 'es', name: '西班牙' },
    { code: 'it', name: '意大利' },
    
    // 拉美
    { code: 'br', name: '巴西' },
    { code: 'mx', name: '墨西哥' },
    
    // 特色
    { code: 'ru', name: '俄罗斯' },
    { code: 'th', name: '泰国' },
    { code: 'in', name: '印度' },
  ];

  static _parseFilterId(filterId) {
    if (!filterId || !filterId.includes('_')) return { country: 'cn', genre: '26' };
    const [country, genre] = filterId.split('_');
    return { country, genre: genre || '26' };
  }

  static _safeCallback(fn, data) {
    try {
      const injector = typeof angular !== 'undefined' && angular.element?.(document.body)?.injector?.();
      if (injector) return injector.get('$rootScope').$applyAsync(() => fn(data));
    } catch (e) { /* ignore */ }
    setTimeout(() => fn(data), 0);
  }

  static async _fetchChart(country, genre, offset, limit) {
    const cacheKey = `${country}_${genre}`;
    const cached = this._chartListCache[cacheKey];
    if (cached && Date.now() - cached.fetchedAt < 600000) { // 10分钟缓存
      return cached.items.slice(offset, offset + limit);
    }

    try {
      const genreParam = genre !== '26' ? `/genre=${genre}` : '';
      const rssUrl = `${this.RSS_API}/${country}/rss/toppodcasts/limit=200${genreParam}/json`;
      const { data } = await axios.get(rssUrl);
      const entries = data?.feed?.entry || [];
      if (!entries.length) return [];

      const ids = entries.map(e => e.id?.attributes?.['im:id']).filter(Boolean);
      const feedUrlMap = {};
      if (ids.length) {
        try {
          const { data: lookupData } = await axios.get(this.LOOKUP_API, { params: { id: ids.join(','), country: country.toUpperCase() } });
          lookupData?.results?.forEach(r => { if (r.feedUrl) feedUrlMap[r.collectionId] = r.feedUrl; });
        } catch (e) { /* ignore */ }
      }

      const items = entries.map(e => {
        const appleId = e.id?.attributes?.['im:id'] || '';
        return {
          appleId,
          name: e['im:name']?.label || '',
          artistName: e['im:artist']?.label || '',
          feedUrl: feedUrlMap[appleId] || '',
          artworkUrl: e['im:image']?.slice(-1)[0]?.label || '',
        };
      });

      this._chartListCache[cacheKey] = { items, fetchedAt: Date.now() };
      return items.slice(offset, offset + limit);
    } catch (e) {
      return cached ? cached.items.slice(offset, offset + limit) : [];
    }
  }

  static show_playlist(url) {
    const offset = parseInt(getParameterByName('offset', url), 10) || 0;
    const { country, genre } = this._parseFilterId(getParameterByName('filter_id', url));

    return {
      success: async (fn) => {
        try {
          const items = await this._fetchChart(country, genre, offset, 30);
          const result = items.map(item => {
            this._chartCache[item.appleId] = item; // 统一缓存结构
            return {
              id: `poplaylist_chart_${item.appleId}`,
              title: item.name,
              source: 'podcast',
              source_url: item.feedUrl,
              img_url: item.artworkUrl,
              cover_img_url: item.artworkUrl,
              author: item.artistName,
            };
          });
          this._safeCallback(fn, { result });
        } catch {
          this._safeCallback(fn, { result: [] });
        }
      }
    };
  }

  static get_playlist_filters() {
    const recommend = [
    // 综合榜
    { id: '', name: '全部' },
    
    // 热门分类
    { id: 'cn_1318', name: '科技' },
    { id: 'cn_1324', name: '社会' },
    { id: 'cn_1489', name: '新闻' },
    { id: 'cn_1304', name: '教育' },
    { id: 'cn_1321', name: '商务' },

    // 娱乐
    { id: 'cn_1310', name: '音乐' },
    { id: 'cn_1309', name: '影视' },
    { id: 'cn_1303', name: '喜剧' },
    { id: 'cn_1301', name: '艺术' },
  ];

    const all = [
      {
        category: '地区',
        filters: this.COUNTRIES.map(c => ({ id: `${c.code}_all`, name: c.name })),
      },
      {
        category: '主题',
        filters: this.GENRES.filter(g => g.id !== '26').map(g => ({ id: `cn_${g.id}`, name: g.name })),
      },
    ];

    return { success: (fn) => this._safeCallback(fn, { recommend, all }) };
  }

  static _getPodcastById(rawId) {
    return rawId.startsWith('chart_') ? this._chartCache[rawId.slice(6)] : null;
  }

  // 6. 重构 get_playlist：移除复杂的 _doGetPlaylist 传递，统一在函数内部使用 await 处理逻辑
  static get_playlist(url) {
    const listId = getParameterByName('list_id', url);
    const rawId = listId.replace(/^poplaylist_/, '');
    const cached = this._getPodcastById(rawId);
    
    return {
      success: async (fn) => {
        let rssUrl = cached?.feedUrl;
        let title = cached?.name || '';
        let cover_img_url = cached?.artworkUrl || '';
        const appleId = rawId.replace(/^chart_/, '');

        if (!rssUrl && rawId.startsWith('chart_')) {
          try {
            const { data } = await axios.get(this.LOOKUP_API, { params: { id: appleId } });
            const found = data?.results?.[0];
            if (found?.feedUrl) {
              rssUrl = found.feedUrl;
              title = found.trackName || found.collectionName || '';
              cover_img_url = found.artworkUrl600 || found.artworkUrl100 || '';
              this._chartCache[appleId] = { feedUrl: rssUrl, name: title, artistName: found.artistName, artworkUrl: cover_img_url };
            }
          } catch (e) { /* ignore */ }
        }

        if (!rssUrl) {
          return this._safeCallback(fn, { info: { id: listId, title: '', cover_img_url: '', source_url: '' }, tracks: [] });
        }

        try {
          const tracks = await this._parseRss(rssUrl, rawId, title);
          this._safeCallback(fn, { 
            info: { id: listId, title: title || (tracks[0]?.album || ''), cover_img_url, source_url: rssUrl }, 
            tracks 
          });
        } catch {
          this._safeCallback(fn, { info: { id: listId, title, cover_img_url, source_url: rssUrl }, tracks: [] });
        }
      }
    };
  }

  /**
   * 解析 RSS Feed，返回 episode 列表
   * @param {string} rssUrl - RSS 地址
   * @param {string} podcastId - 播客 rawId
   * @param {string} podcastName - 播客名称（用作 artist 显示）
   * @param {AbortSignal} [signal] - 可选的中止信号
   */
  static async _parseRss(rssUrl, podcastId, podcastName, signal) {
    const response = await fetch(rssUrl, { signal });
    const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('RSS Parse Error');

    const playlistId = `poplaylist_${podcastId}`;
    return Array.from(doc.querySelectorAll('item')).reduce((acc, item, i) => {
      const audioUrl = item.querySelector('enclosure')?.getAttribute('url');
      if (audioUrl) {
        acc.push({
          id: `potrack_${podcastId}_${i}`,
          title: item.querySelector('title')?.textContent?.trim() || '',
          artist: podcastName || '',
          artist_id: playlistId,
          album: podcastId,
          album_id: playlistId,
          source: 'podcast', source_url: audioUrl, img_url: '', sound_url: audioUrl,
          pub_date: item.querySelector('pubDate')?.textContent || '',
          description: item.querySelector('description')?.textContent || '',
          disable: false,
        });
      }
      return acc;
    }, []);
  }

  static bootstrap_track(track, success, failure) {
    track.sound_url ? success({ url: track.sound_url, bitrate: '', platform: 'podcast' }) : failure({});
  }

  // 8. search 方法通过 async/await 消除回调嵌套，逻辑更直观
  static search(url) {
    const type = getParameterByName('type', url) || '0';
    const keywords = getParameterByName('keywords', url)?.trim() || '';
    if (type === '0' || !keywords) {
      return { success: (fn) => this._safeCallback(fn, { result: [], total: 0, type }) };
    }

    return {
      success: async (fn) => {
        try {
          const { data } = await axios.get(`https://itunes.apple.com/search?media=podcast&entity=podcast&country=CN&term=${encodeURIComponent(keywords)}`);
          const results = data?.results || [];
          const result = results.map(item => {
            const rssUrl = item.feedUrl || '';
            const appleId = String(item.collectionId || '');
            const artworkUrl = item.artworkUrl600 || item.artworkUrl100 || '';
            const name = item.collectionName || item.trackName || '';
            
            if (rssUrl && appleId) {
              this._chartCache[appleId] = { feedUrl: rssUrl, name, artistName: item.artistName || '', artworkUrl };
            }
            return {
              id: `poplaylist_chart_${appleId}`, title: name, source: 'podcast', source_url: rssUrl,
              img_url: artworkUrl, cover_img_url: artworkUrl, author: item.artistName || '', count: item.trackCount || 0
            };
          });
          this._safeCallback(fn, { result, total: results.length, type: '1' });
        } catch {
          this._safeCallback(fn, { result: [], total: 0, type: '1' });
        }
      }
    };
  }

  static lyric() { return { success: fn => fn({ lyric: '', tlyric: '' }) }; }
  static parse_url() { return { success: fn => fn(undefined) }; }
  static get_user() { return { success: fn => fn({ status: 'fail', data: {} }) }; }
  static get_login_url() { return ''; }
  static logout() {}
}