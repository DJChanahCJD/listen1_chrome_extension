/* global getParameterByName kuwo axios */
// eslint-disable-next-line no-unused-vars
class xiaowo {
  /** lxmusic API 基础 URL */
  static lxApiUrl = 'https://lxmusicapi.onrender.com';

  /**
   * 将 kuwo 搜索结果中的 track 字段转换为 xiaowo 格式
   * ID 前缀: kw → xw
   */
  static _convert_track(track) {
    return {
      ...track,
      id: track.id.replace(/^kw/, 'xw'),
      artist_id: track.artist_id
        ? track.artist_id.replace(/^kw/, 'xw')
        : track.artist_id,
      album_id: track.album_id
        ? track.album_id.replace(/^kw/, 'xw')
        : track.album_id,
      source: 'xiaowo',
      source_url: track.source_url,
    };
  }

  /**
   * 将 kuwo 歌单结果转换为 xiaowo 格式
   */
  static _convert_playlist_result(data) {
    const info = {
      ...data.info,
      id: data.info.id.replace(/^kw/, 'xw'),
    };
    const tracks = data.tracks.map((t) => this._convert_track(t));
    return { info, tracks };
  }

  /**
   * 获取播放 URL，走 lxmusic API
   * 参考源: temp/xiaowo.js getMediaSource
   */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const song_id = track.id.slice('xwtrack_'.length);
    const target_url = `${this.lxApiUrl}/url/kw/${song_id}/320k`;
    axios
      .get(target_url, {
        headers: { 'X-Request-Key': 'share-v3' },
      })
      .then((response) => {
        const { data } = response;
        if (data.url) {
          sound.url = data.url;
          sound.bitrate = '320kbps';
          sound.platform = 'xiaowo';
          success(sound);
        } else {
          failure(sound);
        }
      })
      .catch(() => failure(sound));
  }

  /** 搜索，委托 kuwo 并转换结果 ID 前缀 */
  static search(url) {
    return {
      success: (fn) =>
        kuwo.search(url).success((data) => {
          const result = data.result.map((t) => this._convert_track(t));
          return fn({ ...data, result });
        }),
    };
  }

  /** 歌单列表，委托 kuwo */
  static show_playlist(url) {
    return kuwo.show_playlist(url);
  }

  /** 歌单详情，委托 kuwo 并转换结果 ID 前缀 */
  static get_playlist(url) {
    const listId = getParameterByName('list_id', url);
    const kwListId = listId.replace(/^xw/, 'kw');
    const kwUrl = url.replace(listId, kwListId);
    return {
      success: (fn) =>
        kuwo.get_playlist(kwUrl).success((data) => {
          fn(this._convert_playlist_result(data));
        }),
    };
  }

  /** 歌词，委托 kuwo（ID 前缀 xw → kw） */
  static lyric(url) {
    const trackId = getParameterByName('track_id', url);
    const kwTrackId = trackId.replace(/^xw/, 'kw');
    const kwUrl = url.replace(trackId, kwTrackId);
    return kuwo.lyric(kwUrl);
  }

  /** 解析 URL，委托 kuwo 并转换结果 ID 前缀 */
  static parse_url(url) {
    return {
      success: (fn) =>
        kuwo.parse_url(url).success((result) => {
          if (result && result.id) {
            fn({ ...result, id: result.id.replace(/^kw/, 'xw') });
          } else {
            fn(result);
          }
        }),
    };
  }

  /** 歌单筛选，委托 kuwo */
  static get_playlist_filters() {
    return kuwo.get_playlist_filters();
  }

  /** 获取用户信息，kuwo 不支持登录 */
  static get_user() {
    return { success: (fn) => fn({ status: 'fail', data: {} }) };
  }

  /** 获取登录页 URL，kuwo 不支持登录 */
  static get_login_url() {
    return '';
  }

  /** 登出，kuwo 不支持登录 */
  static logout() {}
}
