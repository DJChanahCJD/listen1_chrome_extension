/* global getParameterByName netease axios */
// eslint-disable-next-line no-unused-vars
class gdnetease {
  /** GD API 基础 URL */
  static gdApiUrl = 'https://music-api.gdstudio.xyz/api.php';

  /**
   * 将 netease 搜索结果中的 track 字段转换为 gdnetease 格式
   * source: netease → gdnetease, id 前缀: ne → gn
   */
  static _convert_track(track) {
    return {
      ...track,
      id: track.id.replace(/^ne/, 'gn'),
      artist_id: track.artist_id ? track.artist_id.replace(/^ne/, 'gn') : track.artist_id,
      album_id: track.album_id ? track.album_id.replace(/^ne/, 'gn') : track.album_id,
      source: 'gdnetease',
      source_url: track.source_url,
    };
  }

  /**
   * 将 netease 歌单结果中的 track 列表转换为 gdnetease 格式
   */
  static _convert_playlist_result(data) {
    const info = {
      ...data.info,
      id: data.info.id.replace(/^ne/, 'gn'),
    };
    const tracks = data.tracks.map((t) => this._convert_track(t));
    return { info, tracks };
  }

  /** 获取播放 URL，走 GD API；失败时回退到官方 netease */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const song_id = track.id.slice('gntrack_'.length);
    const target_url = `${this.gdApiUrl}?types=url&source=netease&id=${song_id}&br=320`;
    axios
      .get(target_url)
      .then((response) => {
        const { data } = response;
        if (data.url) {
          sound.url = data.url;
          sound.bitrate = data.br ? `${data.br}kbps` : '';
          sound.platform = 'gdnetease';
          success(sound);
        } else {
          // GD API 未返回 URL，回退到官方 netease
          const neTrack = {
            ...track,
            id: `netrack_${song_id}`,
            source: 'netease',
          };
          netease.bootstrap_track(neTrack, success, failure);
        }
      })
      .catch(() => {
        // GD API 请求失败，回退到官方 netease
        const neTrack = {
          ...track,
          id: `netrack_${song_id}`,
          source: 'netease',
        };
        netease.bootstrap_track(neTrack, success, failure);
      });
  }

  /** 搜索，委托 netease 并转换结果 */
  static search(url) {
    return {
      success: (fn) =>
        netease.search(url).success((data) => {
          const result = data.result.map((t) => this._convert_track(t));
          return fn({ ...data, result });
        }),
    };
  }

  /** 歌单列表，委托 netease */
  static show_playlist(url) {
    return netease.show_playlist(url);
  }

  /** 歌单详情，委托 netease 并转换结果 ID 前缀 */
  static get_playlist(url) {
    const listId = getParameterByName('list_id', url);
    const neListId = listId.replace(/^gn/, 'ne');
    const neUrl = url.replace(listId, neListId);
    return {
      success: (fn) =>
        netease.get_playlist(neUrl).success((data) => {
          fn(this._convert_playlist_result(data));
        }),
    };
  }

  /** 歌词，委托 netease（ID 前缀 gn → ne） */
  static lyric(url) {
    const trackId = getParameterByName('track_id', url);
    const neTrackId = trackId.replace(/^gn/, 'ne');
    const neUrl = url.replace(trackId, neTrackId);
    return netease.lyric(neUrl);
  }

  /** 解析 URL，委托 netease 并转换结果 ID 前缀 */
  static parse_url(url) {
    return {
      success: (fn) =>
        netease.parse_url(url).success((result) => {
          if (result && result.id) {
            fn({ ...result, id: result.id.replace(/^ne/, 'gn') });
          } else {
            fn(result);
          }
        }),
    };
  }

  /** 歌单筛选，委托 netease */
  static get_playlist_filters() {
    return netease.get_playlist_filters();
  }

  /** 获取用户信息，委托 netease */
  static get_user() {
    return {
      success: (fn) =>
        netease.get_user().success((data) => {
          if (data.status === 'success' && data.data) {
            fn({ ...data, data: { ...data.data, platform: 'gdnetease' } });
          } else {
            fn(data);
          }
        }),
    };
  }

  /** 获取登录页 URL，委托 netease */
  static get_login_url() {
    return netease.get_login_url();
  }

  /** 登出，委托 netease */
  static logout() {
    return netease.logout();
  }

  /** 登录，委托 netease 并转换平台标识 */
  static login(url) {
    return {
      success: (fn) =>
        netease.login(url).success((data) => {
          if (data.status === 'success' && data.data) {
            fn({
              ...data,
              data: { ...data.data, platform: 'gdnetease' },
            });
          } else {
            fn(data);
          }
        }),
    };
  }
}
