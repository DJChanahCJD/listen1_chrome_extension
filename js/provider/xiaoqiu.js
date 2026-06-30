/* global getParameterByName qq axios */
// eslint-disable-next-line no-unused-vars
class xiaoqiu {
  /** lxmusic API 基础 URL */
  static lxApiUrl = 'https://lxmusicapi.onrender.com';

  /**
   * 将 qq 搜索结果中的 track 字段转换为 xiaoqiu 格式
   * ID 前缀: qq → xq
   */
  static _convert_track(track) {
    return {
      ...track,
      id: track.id.replace(/^qq/, 'xq'),
      artist_id: track.artist_id
        ? track.artist_id.replace(/^qq/, 'xq')
        : track.artist_id,
      album_id: track.album_id
        ? track.album_id.replace(/^qq/, 'xq')
        : track.album_id,
      source: 'xiaoqiu',
      source_url: track.source_url,
    };
  }

  /**
   * 将 qq 歌单结果转换为 xiaoqiu 格式
   */
  static _convert_playlist_result(data) {
    const info = {
      ...data.info,
      id: data.info.id.replace(/^qq/, 'xq'),
    };
    const tracks = data.tracks.map((t) => this._convert_track(t));
    return { info, tracks };
  }

  /**
   * 获取播放 URL，走 lxmusic API
   * 参考源: temp/xiaoqiu.js getMediaSource
   */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const songmid = track.id.slice('xqtrack_'.length);
    const target_url = `${this.lxApiUrl}/url/tx/${songmid}/320k`;
    axios
      .get(target_url, {
        headers: { 'X-Request-Key': 'share-v3' },
      })
      .then((response) => {
        const { data } = response;
        if (data.url) {
          sound.url = data.url;
          sound.bitrate = '320kbps';
          sound.platform = 'xiaoqiu';
          success(sound);
        } else {
          failure(sound);
        }
      })
      .catch(() => failure(sound));
  }

  /** 搜索，委托 qq 并转换结果 ID 前缀 */
  static search(url) {
    return {
      success: (fn) =>
        qq.search(url).success((data) => {
          const result = data.result.map((t) => this._convert_track(t));
          return fn({ ...data, result });
        }),
    };
  }

  /** 歌单列表，委托 qq */
  static show_playlist(url) {
    return qq.show_playlist(url);
  }

  /** 歌单详情，委托 qq 并转换结果 ID 前缀 */
  static get_playlist(url) {
    const listId = getParameterByName('list_id', url);
    const qqListId = listId.replace(/^xq/, 'qq');
    const qqUrl = url.replace(listId, qqListId);
    return {
      success: (fn) =>
        qq.get_playlist(qqUrl).success((data) => {
          fn(this._convert_playlist_result(data));
        }),
    };
  }

  /** 歌词，委托 qq（ID 前缀 xq → qq） */
  static lyric(url) {
    const trackId = getParameterByName('track_id', url);
    const qqTrackId = trackId.replace(/^xq/, 'qq');
    const qqUrl = url.replace(trackId, qqTrackId);
    return qq.lyric(qqUrl);
  }

  /** 解析 URL，委托 qq 并转换结果 ID 前缀 */
  static parse_url(url) {
    return {
      success: (fn) =>
        qq.parse_url(url).success((result) => {
          if (result && result.id) {
            fn({ ...result, id: result.id.replace(/^qq/, 'xq') });
          } else {
            fn(result);
          }
        }),
    };
  }

  /** 歌单筛选，委托 qq */
  static get_playlist_filters() {
    return qq.get_playlist_filters();
  }

  /** 获取用户信息，委托 qq 并转换平台标识 */
  static get_user() {
    return {
      success: (fn) =>
        qq.get_user().success((data) => {
          if (data.status === 'success' && data.data) {
            fn({ ...data, data: { ...data.data, platform: 'xiaoqiu' } });
          } else {
            fn(data);
          }
        }),
    };
  }

  /** 获取登录页 URL，委托 qq */
  static get_login_url() {
    return qq.get_login_url();
  }

  /** 登出，委托 qq */
  static logout() {
    return qq.logout();
  }
}
