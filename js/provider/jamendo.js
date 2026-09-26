/* global getParameterByName axios forge */
// eslint-disable-next-line no-unused-vars
class jamendo {
  /** 站点内部搜索接口（网页前端同款），无 client_id、无登录 */
  static API_BASE = 'https://www.jamendo.com';

  /** 搜索接口 path，同时是 x-jam-call 的签名原文 */
  static SEARCH_PATH = '/api/search';

  /** 站点只有一档音频流，mp32 实测可用（mp31 约 96kbps，mp33 多数曲目不存在） */
  static STORAGE_BASE = 'https://prod-1.storage.jamendo.com';

  static AUDIO_FORMAT = 'mp32';

  /** 搜索分页大小（listen1 搜索页按 20 条/页换算总页数） */
  static PAGE_SIZE = 20;

  /**
   * 生成 x-jam-call 请求头，格式：$ + sha1(path + rand) 十六进制 + * + rand + ~
   * 无密钥，本地可算；签名用的 path 必须与请求 URL 的 path 完全一致
   */
  static _call_header(path) {
    const rand = String(Math.random());
    const digest = forge.md.sha1.create().update(path + rand).digest().toHex();
    return `$${digest}*${rand}~`;
  }

  /**
   * 调站点内部搜索接口
   * @param {string} type 资源类型，实测支持 track / album / artist
   * @param {string} keyword 关键词
   * @param {number} offset 偏移量（接口只认 offset，不认 page）
   * @param {number} limit 条数
   * @returns {Promise<Array>} 原始结果数组
   */
  static _api_search(type, keyword, offset, limit) {
    return axios
      .get(`${this.API_BASE}${this.SEARCH_PATH}`, {
        params: {
          query: keyword,
          type,
          identities: 'www',
          limit,
          offset,
        },
        headers: { 'x-jam-call': this._call_header(this.SEARCH_PATH) },
      })
      .then((response) => (Array.isArray(response.data) ? response.data : []));
  }

  /**
   * 搜索结果 → listen1 曲目模型
   * 搜索接口一次返回全部字段，封面为 http 直链，取流为确定性模板
   */
  static _convert_track(song) {
    const artist_name = song.artist ? song.artist.name || '' : '';
    const album_name = song.album ? song.album.name || '' : '';
    return {
      id: `jatrack_${song.id}`,
      title: song.name || '',
      artist: artist_name,
      artist_id: `jaartist_${encodeURIComponent(artist_name)}`,
      album: album_name,
      album_id: `jaalbum_${encodeURIComponent(album_name)}`,
      source: 'jamendo',
      source_url: `${this.API_BASE}/track/${song.id}`,
      img_url: (song.cover && song.cover.big ? song.cover.big.size300 : '') || '',
      disable: false,
    };
  }

  /**
   * 推算总条数：接口不返回总数，按「已翻到第 curpage 页 + 是否还有下一页」折算，
   * 保证 listen1（固定 20 条/页换算页数）的翻页按钮可用
   */
  static _total(curpage, has_more) {
    return (curpage + (has_more ? 1 : 0)) * this.PAGE_SIZE;
  }

  /** 搜索：站点只有单曲搜索，歌单搜索返回空 */
  static search(url) {
    const keyword = (getParameterByName('keywords', url) || '').trim();
    const curpage = parseInt(getParameterByName('curpage', url), 10) || 1;
    const search_type = getParameterByName('type', url) || '0';

    if (search_type !== '0' || !keyword) {
      return {
        success: (fn) => fn({ result: [], total: 0, type: search_type }),
      };
    }

    const offset = (curpage - 1) * this.PAGE_SIZE;
    return {
      success: (fn) => {
        this._api_search('track', keyword, offset, this.PAGE_SIZE)
          .then((songs) => {
            const result = songs.map((song) => this._convert_track(song));
            fn({
              result,
              // 满一页视为还有下一页
              total: this._total(curpage, result.length === this.PAGE_SIZE),
              type: search_type,
            });
          })
          .catch(() => fn({ result: [], total: 0, type: search_type }));
      },
    };
  }

  /** 取流：音频直链是确定性模板，无需额外请求 */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const track_id = (track.id || '').replace(/^jatrack_/, '');
    if (!track_id) {
      failure(sound);
      return;
    }
    sound.url = `${this.STORAGE_BASE}/?trackid=${track_id}&format=${this.AUDIO_FORMAT}`;
    // 站点只有一档音频流，不做码率探测
    sound.bitrate = '';
    sound.platform = 'jamendo';
    success(sound);
  }

  /** 站点无歌词数据 */
  static lyric() {
    return { success: (fn) => fn({ lyric: '', tlyric: '' }) };
  }

  /**
   * 歌单详情：站点内部接口没有专辑/歌手详情，用同名搜索代偿
   * id 形如 jaartist_{歌手名} / jaalbum_{专辑名}
   */
  static get_playlist(url) {
    const list_id = getParameterByName('list_id', url) || '';
    const matched = /^ja(?:artist|album)_(.+)$/.exec(list_id);
    const keyword = matched ? decodeURIComponent(matched[1]) : '';
    const empty_info = { id: list_id, title: '', cover_img_url: '', source_url: '' };

    return {
      success: (fn) => {
        if (!keyword) {
          fn({ info: empty_info, tracks: [] });
          return;
        }
        this._api_search('track', keyword, 0, this.PAGE_SIZE)
          .then((songs) => {
            const tracks = songs.map((song) => this._convert_track(song));
            fn({
              info: {
                id: list_id,
                title: keyword,
                cover_img_url: tracks.length ? tracks[0].img_url : '',
                source_url: `${this.API_BASE}/search?q=${encodeURIComponent(
                  keyword
                )}`,
              },
              tracks,
            });
          })
          .catch(() => fn({ info: { ...empty_info, title: keyword }, tracks: [] }));
      },
    };
  }

  /** 站点无歌单列表接口 */
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
