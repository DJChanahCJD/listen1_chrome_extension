/* global getParameterByName axios LRUCache DOMParser */
// eslint-disable-next-line no-unused-vars
class higequ {
  /** 站点由 PHP 服务端渲染，没有任何 JSON 接口，只能抓 HTML 解析 */
  static BASE = 'https://higequ.com';

  /** 站点搜索页固定 10 条/页 */
  static PAGE_SIZE = 10;

  /**
   * listen1 搜索页固定按 20 条/页换算总页数（instant_search.js: ceil(total/20)），
   * 因此一格 listen1 页对应站点的 2 页，取满 20 条
   */
  static LIST_PAGE_SIZE = 20;

  static SITE_PAGES_PER_PAGE = 2;

  /**
   * 播放页解析结果缓存（取流 / 封面 / 歌词都来自播放页，解析成本高）
   * TTL 10 分钟，容量 50
   */
  static _detail_cache = new LRUCache({ max: 50, maxAge: 10 * 60 * 1000 });

  /** 搜索页缓存，key = keyword::page，TTL 2 分钟，容量 30 */
  static _search_cache = new LRUCache({ max: 30, maxAge: 2 * 60 * 1000 });

  /** in-flight 去重：同一 rid 并发请求复用同一个 Promise */
  static _pending_detail = {};

  /**
   * 抓取页面并解析成 DOM
   * @param {string} path 站点相对路径，如 /s/关键词/1/
   * @returns {Promise<Document>}
   */
  static _fetch_doc(path) {
    return axios
      .get(`${this.BASE}${path}`, { responseType: 'text' })
      .then((response) =>
        new DOMParser().parseFromString(response.data, 'text/html')
      );
  }

  /** 文本清洗：去首尾空白并折叠连续空白 */
  static _clean_text(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * 是否还有下一页：站点用 #next-page 按钮的 disabled 属性标记
   * 分页控件缺失（站点改版）时保守返回 false，避免聚合搜索无限翻页
   */
  static _has_next_page(doc) {
    const next_button = doc.querySelector('#next-page');
    return !!next_button && !next_button.hasAttribute('disabled');
  }

  /**
   * 站点的总页数：分页控件 #page-numbers 里最大的页码（站点每页都会带上总页数）
   * 末页之后的空页没有分页控件，返回 0
   */
  static _last_site_page(doc) {
    const container = doc.querySelector('#page-numbers');
    if (!container) {
      return 0;
    }
    const numbers = (container.textContent.match(/\d+/g) || []).map(Number);
    return numbers.length ? Math.max(...numbers) : 0;
  }

  /** 搜索页条目 → listen1 曲目模型 */
  static _convert_track(item) {
    const rid = item.getAttribute('data-rid') || '';
    const artist = this._clean_text(
      (item.querySelector('.result-artist') || {}).textContent
    );
    const album = this._clean_text(
      (item.querySelector('.result-album') || {}).textContent
    ).replace(/^专辑[:：]\s*/, '');
    return {
      id: `hqtrack_${rid}`,
      title: this._clean_text(
        (item.querySelector('.result-title') || {}).textContent
      ),
      // 站点用 & 连接多歌手（五月天&周杰伦），listen1 的 artist 是单字符串，
      // 保持原样不拆分，避免误伤 "Simon & Garfunkel" 这类西文名
      artist,
      artist_id: `hqartist_${encodeURIComponent(artist)}`,
      album,
      album_id: `hqalbum_${encodeURIComponent(album)}`,
      source: 'higequ',
      source_url: `${this.BASE}/player/${rid}/`,
      // 搜索页不含封面，真实封面在播放页，取流时一并解析并缓存
      img_url: '',
      disable: false,
    };
  }

  /** 歌词行 → LRC 文本（站点给的是秒数，缺 [offset:] 行不影响播放器逐行解析） */
  static _lines_to_lrc(lines) {
    return Array.from(lines)
      .map((line) => {
        const seconds = parseFloat(line.getAttribute('data-time')) || 0;
        const minutes = Math.floor(seconds / 60);
        const rest = seconds - minutes * 60;
        const stamp = `${String(minutes).padStart(2, '0')}:${rest
          .toFixed(2)
          .padStart(5, '0')}`;
        return `[${stamp}]${this._clean_text(line.textContent)}`;
      })
      .join('\n');
  }

  /**
   * 解析播放页：音频直链（脚本内联 base64）、封面、歌词
   * @returns {{audio_url: string, cover_url: string, lyric: string}}
   */
  static _parse_player_page(doc) {
    let audio_url = '';
    Array.from(doc.querySelectorAll('script')).some((script) => {
      const matched = /let\s+code\s*=\s*"([A-Za-z0-9+/=]+)"/.exec(
        script.textContent || ''
      );
      if (!matched) {
        return false;
      }
      try {
        const decoded = atob(matched[1]);
        if (/^https?:\/\//.test(decoded)) {
          audio_url = decoded;
          return true;
        }
      } catch (error) {
        // base64 非法时继续找下一个脚本
      }
      return false;
    });

    const cover = doc.querySelector('#album-cover');
    return {
      audio_url,
      cover_url: cover ? cover.getAttribute('src') || '' : '',
      lyric: this._lines_to_lrc(doc.querySelectorAll('.lyric-line[data-time]')),
    };
  }

  /**
   * 获取播放页详情，带缓存 + in-flight 去重
   * 失败不写缓存，交给上层兜底
   * @param {string} rid 站点内部歌曲 id
   */
  static _get_detail(rid) {
    const cached = this._detail_cache.get(rid);
    if (cached) {
      // 命中后重新 set，刷新 LRU 顺序与 TTL
      this._detail_cache.set(rid, cached);
      return Promise.resolve(cached);
    }
    if (this._pending_detail[rid]) {
      return this._pending_detail[rid];
    }

    const pending = this._fetch_doc(`/player/${rid}/`)
      .then((doc) => {
        const detail = this._parse_player_page(doc);
        if (!detail.audio_url) {
          throw new Error('higequ: audio url not found');
        }
        this._detail_cache.set(rid, detail);
        return detail;
      })
      .finally(() => {
        delete this._pending_detail[rid];
      });

    this._pending_detail[rid] = pending;
    return pending;
  }

  /** 抓搜索页并解析成曲目数组 */
  static _search_tracks(keyword, page) {
    return this._fetch_doc(`/s/${encodeURIComponent(keyword)}/${page}/`).then(
      (doc) => ({
        tracks: Array.from(doc.querySelectorAll('.result-item[data-rid]')).map(
          (item) => this._convert_track(item)
        ),
        has_more: this._has_next_page(doc),
        last_page: this._last_site_page(doc),
      })
    );
  }

  /** 带缓存的搜索页解析，key = keyword::page */
  static _cached_search(keyword, page) {
    const cache_key = `${keyword}::${page}`;
    const cached = this._search_cache.get(cache_key);
    if (cached) {
      return Promise.resolve(cached);
    }
    return this._search_tracks(keyword, page).then((data) => {
      this._search_cache.set(cache_key, data);
      return data;
    });
  }

  /**
   * 抓「一格」搜索结果：并发抓站点两页（共 20 条），与 listen1 的 20 条/页对齐
   * @param {string} keyword 关键词
   * @param {number} page listen1 页码（1 起）
   * @returns {Promise<{tracks: Array, has_more: boolean, last_page: number}>}
   */
  static _search_batch(keyword, page) {
    const first_site_page = (page - 1) * this.SITE_PAGES_PER_PAGE + 1;
    const site_pages = Array.from(
      { length: this.SITE_PAGES_PER_PAGE },
      (value, index) => first_site_page + index
    );
    return Promise.all(
      site_pages.map((p) => this._cached_search(keyword, p).catch(() => null))
    ).then((results) => {
      const valid = results.filter((result) => result);
      if (!valid.length) {
        throw new Error('higequ: search pages all failed');
      }
      return {
        // 其中一页失败时保留另一页的结果，避免整页空白
        tracks: valid.reduce((acc, result) => acc.concat(result.tracks), []),
        // 有页失败时无法判断后面是否还有内容，保守返回 false
        has_more:
          valid.length === results.length &&
          results[results.length - 1].has_more,
        // 总页数取本格各页里的最大值（末页之后的空页没有分页控件，返回 0）
        last_page: Math.max(...valid.map((result) => result.last_page)),
      };
    });
  }

  /**
   * 推算总条数：
   * 站点标注了总页数时折算成真实条数（站点 10 条/页），让 listen1 的「共 N 页」准确；
   * 否则退化为「已翻到的页数 × 20」，保证翻页按钮可用
   */
  static _total(curpage, has_more, last_page) {
    if (last_page > 0) {
      return last_page * this.PAGE_SIZE;
    }
    return (curpage + (has_more ? 1 : 0)) * this.LIST_PAGE_SIZE;
  }

  /** 搜索：站点只有歌曲搜索页，歌单搜索返回空 */
  static search(url) {
    const keyword = this._clean_text(getParameterByName('keywords', url));
    const curpage = parseInt(getParameterByName('curpage', url), 10) || 1;
    const search_type = getParameterByName('type', url) || '0';

    if (search_type !== '0' || !keyword) {
      return {
        success: (fn) => fn({ result: [], total: 0, type: search_type }),
      };
    }

    return {
      success: (fn) => {
        this._search_batch(keyword, curpage)
          .then((data) => {
            fn({
              result: data.tracks,
              total: this._total(curpage, data.has_more, data.last_page),
              type: search_type,
            });
          })
          .catch(() => fn({ result: [], total: 0, type: search_type }));
      },
    };
  }

  /** 取流：每次播放需解析一次播放页（有缓存，连续切歌不会重复请求） */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const rid = (track.id || '').replace(/^hqtrack_/, '');
    if (!rid) {
      failure(sound);
      return;
    }
    this._get_detail(rid)
      .then((detail) => {
        sound.url = detail.audio_url;
        // 站点只有一档音频流，不做码率探测
        sound.bitrate = '';
        sound.platform = 'higequ';
        success(sound);
      })
      .catch(() => failure(sound));
  }

  /** 歌词：与取流共用同一份播放页解析结果 */
  static lyric(url) {
    const track_id = getParameterByName('track_id', url) || '';
    const rid = track_id.replace(/^hqtrack_/, '');
    return {
      success: (fn) => {
        if (!rid) {
          fn({ lyric: '', tlyric: '' });
          return;
        }
        this._get_detail(rid)
          .then((detail) => fn({ lyric: detail.lyric || '', tlyric: '' }))
          .catch(() => fn({ lyric: '', tlyric: '' }));
      },
    };
  }

  /**
   * 歌单详情：站点没有歌手/专辑页，用同名搜索代偿
   * id 形如 hqartist_{歌手名} / hqalbum_{专辑名}
   */
  static get_playlist(url) {
    const list_id = getParameterByName('list_id', url) || '';
    const matched = /^hq(?:artist|album)_(.+)$/.exec(list_id);

    return {
      success: (fn) => {
        if (!matched) {
          fn({
            info: { id: list_id, title: '', cover_img_url: '', source_url: '' },
            tracks: [],
          });
          return;
        }
        const keyword = decodeURIComponent(matched[1]);
        this._search_batch(keyword, 1)
          .then((data) =>
            fn({
              info: {
                id: list_id,
                title: keyword,
                cover_img_url: '',
                source_url: `${this.BASE}/s/${encodeURIComponent(keyword)}/1/`,
              },
              tracks: data.tracks,
            })
          )
          .catch(() =>
            fn({
              info: { id: list_id, title: keyword, cover_img_url: '', source_url: '' },
              tracks: [],
            })
          );
      },
    };
  }

  /** 站点无歌单列表页 */
  static show_playlist() {
    return { success: (fn) => fn({ result: [] }) };
  }

  static get_playlist_filters() {
    return { success: (fn) => fn({ recommend: [], all: [] }) };
  }

  static parse_url() {
    return { success: (fn) => fn(undefined) };
  }

  static get_user() {
    return { success: (fn) => fn({ status: 'fail', data: {} }) };
  }

  static get_login_url() {
    return '';
  }

  static logout() {}
}
