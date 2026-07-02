/* global getParameterByName axios localStorage angular */
// eslint-disable-next-line no-unused-vars
class asmrone {
  static apiBase = 'https://api.asmr-300.com';
  static token = null;
  static _lastRequestTime = 0;
  static _minInterval = 600;

  /**
   * 修复 AngularJS 不刷新问题 (使用可选链简化判断)
   */
  static _safeCallback(fn, data) {
    try {
      const injector = typeof angular !== 'undefined' && angular.element?.(document.body)?.injector?.();
      if (injector) {
        return injector.get('$rootScope').$applyAsync(() => fn(data));
      }
    } catch (e) {}

    // fallback
    setTimeout(() => fn(data), 0);
  }

  static async _rateLimit() {
    const elapsed = Date.now() - this._lastRequestTime;
    if (elapsed < this._minInterval) {
      await new Promise(r => setTimeout(r, this._minInterval - elapsed));
    }
    this._lastRequestTime = Date.now();
  }

  static async _initAuth() {
    if (this.token) return this.token;

    const { name = 'guest', password = 'guest' } = localStorage.getObject('asmrone_account') || {};

    try {
      await this._rateLimit();
      const { data } = await axios.post(`${this.apiBase}/api/auth/me`, { name, password });
      if (data?.token) this.token = data.token;
    } catch (e) {}

    return this.token;
  }

  /**
   * 核心请求方法，合并抽离 GET 和 POST 中重复的鉴权、限流与 401 重试逻辑
   */
  static async _request(method, path, data = null, retry = false) {
    const token = await this._initAuth();
    const headers = { accept: 'application/json,text/plain,*/*' };
    
    if (method === 'post') headers['content-type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    await this._rateLimit();

    try {
      const config = { method, url: `${this.apiBase}${path}`, headers };
      if (data) config.data = data;
      return await axios(config);
    } catch (e) {
      if (!retry && e.response?.status === 401) {
        this.token = null;
        return this._request(method, path, data, true);
      }
      throw e;
    }
  }

  static _apiGet = (path) => this._request('get', path);
  static _apiPost = (path, body) => this._request('post', path, body);

  static _extractNumericId = (id) => id?.match(/\d+/)?.[0] || id;

  static _workToPlaylist(work) {
    const id = work.source_id || work.id;
    const cover = work.mainCoverUrl || work.samCoverUrl || '';
    
    return {
      id: `aoplaylist_${id}`,
      title: work.title || '',
      source_url: `https://asmr.one/work/${id}`,
      img_url: cover,
      cover_img_url: cover,
      author:
        work.vas?.map(v => v.name).join(', ') ||
        work.circle?.name || '',
      count: undefined
    };
  }

  /**
   * 获取作品音轨列表（展开嵌套树为扁平音轨数组）
   * @param {string} listId - 格式: aoplaylist_RJ01234567 或 aoplaylist_01234567
   * @returns {{ success: (fn) => void }}
   */
  static _get_work_tracks(listId) {
    const fullId = listId.replace(/^aoplaylist_/, '');
    const numericId = this._extractNumericId(fullId);
    const info = { title: '', cover_img_url: '', id: listId, source_url: `https://asmr.one/work/${fullId}` };

    return {
      success: (fn) => {
        Promise.all([
          this._apiGet(`/api/work/${numericId}`).catch(() => null),
          this._apiGet(`/api/tracks/${numericId}`).catch(() => null),
        ])
          .then(([workRes, tracksRes]) => {
            const work = workRes?.data;
            const artist = work?.vas?.map(v => v.name).join(', ') || '';
            if (work) {
              info.title = work.title || '';
              info.cover_img_url = work.mainCoverUrl || work.samCoverUrl || '';
            }
            const rawTracks = Array.isArray(tracksRes?.data) ? tracksRes.data : [];
            const tracks = this._flattenTracks(rawTracks, numericId, fullId, listId, artist);
            if (!info.title && tracks.length > 0) {
              info.title = tracks[0].album || '';
            }
            this._safeCallback(fn, { info, tracks });
          })
          .catch(() => this._safeCallback(fn, { info, tracks: [] }));
      }
    };
  }

  /**
   * 递归展平音轨树为扁平数组
   * @param {Array} nodes - API 返回的嵌套音轨树
   * @param {string} numericId - 数字 ID
   * @param {string} listId - 完整歌单 ID
   * @returns {Array} 扁平音轨数组
   */
  static _flattenTracks(nodes, numericId, fullId, listId, artist = '') {
    const result = [];
    for (const node of nodes) {
      if (node.type === 'folder' && Array.isArray(node.children)) {
        result.push(...this._flattenTracks(node.children, numericId, fullId, listId, artist));
      } else if (node.type === 'audio') {
        result.push({
          id: `aotrack_${numericId}_${node.hash || node.title}`,
          title: node.title?.replace(/\.[^.]+$/, '') || '',
          artist,
          artist_id: '',
          album: fullId,
          album_id: listId,
          source: 'asmrone',
          source_url: node.mediaStreamUrl || '',
          img_url: '',
          sound_url: node.mediaStreamUrl || '',
          disable: false,
        });
      }
    }
    return result;
  }

  static bootstrap_track(track, success, failure) {
    track.sound_url 
      ? success({ url: track.sound_url, bitrate: '', platform: 'asmrone' }) 
      : failure({});
  }

  static search(url) {
    // type=0: 单曲搜索 → 不支持，返回空
    // type=1: 歌单搜索 → 走作品搜索
    const searchType = getParameterByName('type', url) || '0';
    if (searchType === '0') {
      return { success: (fn) => this._safeCallback(fn, { result: [], total: 0 }) };
    }

    const keywords = getParameterByName('keywords', url) || '';
    const page = parseInt(getParameterByName('curpage', url), 10) || 1;

    return {
      success: (fn) => {
        this._apiGet(`/api/search/${encodeURIComponent(keywords)}?order=dl_count&sort=desc&page=${page}&pageSize=20`)
          .then(res => {
            const works = res.data?.works || [];
            this._safeCallback(fn, {
              result: works.map(w => this._workToPlaylist(w)),
              total: res.data?.pagination?.totalCount || works.length
            });
          })
          .catch(() => this._safeCallback(fn, { result: [], total: 0 }));
      }
    };
  }

  /**
   * 精选歌单 — 热门作品（支持滚动分页）
   */
  static show_playlist(url) {
    const pageSize = 30;
    const offset = parseInt(getParameterByName('offset', url), 10) || 0;
    const page = Math.floor(offset / pageSize) + 1;

    return {
      success: (fn) => {
        this._apiPost('/api/recommender/popular', {
          keyword: '', page, pageSize, subtitle: 0, localSubtitledWorks: [], withPlaylistStatus: []
        })
          .then(res => this._safeCallback(fn, { 
            result: (res.data?.works || []).map(w => this._workToPlaylist(w)) 
          }))
          .catch(() => this._safeCallback(fn, { result: [] }));
      }
    };
  }

  static get_playlist(url) {
    const id = getParameterByName('list_id', url);
    if (id?.startsWith('aoplaylist_')) return this._get_work_tracks(id);

    return { success: (fn) => this._safeCallback(fn, { info: {}, tracks: [] }) };
  }

  static get_recommend_playlist() {
    return {
      success: (fn) => {
        this.show_playlist().success(data => {
          this._safeCallback(fn, {
            status: 'success',
            data: {
              playlists: data.result.map(i => ({
                id: i.id,
                title: i.title,
                cover_img_url: i.cover_img_url,
                source_url: i.source_url
              }))
            }
          });
        });
      }
    };
  }

  static parse_url(url) {
    const match = url.match(/(?:RJ|VJ|BJ|AJ|CJ|DL|NP|AL|KN)\d{6,}/i);
    return {
      success: (fn) => fn(match ? { id: `aoplaylist_${match[0]}` } : undefined)
    };
  }

  static lyric() { return { success: (fn) => fn({ lyric: '', tlyric: '' }) }; }
  static get_user() { return { success: (fn) => fn({ status: 'fail', data: {} }) }; }
  static get_login_url() { return ''; }
  static logout() {}
}