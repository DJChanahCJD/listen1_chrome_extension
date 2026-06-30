/* global getParameterByName axios */
// eslint-disable-next-line no-unused-vars
class joox {
  /** GD API 基础 URL */
  static gdApiUrl = 'https://music-api.gdstudio.xyz/api.php';

  /** 搜索歌曲，走 GD API */
  static search(url) {
    const keyword = getParameterByName('keywords', url);
    const curpage = getParameterByName('curpage', url);
    const count = 20;
    const target_url = `${this.gdApiUrl}?types=search&source=joox&name=${encodeURIComponent(keyword)}&count=${count}&pages=${curpage}`;
    return {
      success: (fn) => {
        axios
          .get(target_url)
          .then((response) => {
            const result = response.data.map((item) => ({
              id: `jxtrack_${item.id}`,
              title: item.name,
              artist: Array.isArray(item.artist) ? item.artist.join(', ') : item.artist,
              album: item.album,
              source: 'joox',
              source_url: '',
              img_url: item.pic_id
                ? `${this.gdApiUrl}?types=pic&source=joox&id=${item.pic_id}`
                : '',
              lyric_url: item.lyric_id || '',
            }));
            return fn({ result, total: result.length, type: '0' });
          })
          .catch(() => fn({ result: [], total: 0, type: '0' }));
      },
    };
  }

  /** 获取播放 URL，走 GD API */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const song_id = track.id.slice('jxtrack_'.length);
    const target_url = `${this.gdApiUrl}?types=url&source=joox&id=${song_id}&br=320`;
    axios
      .get(target_url)
      .then((response) => {
        const { data } = response;
        if (data.url) {
          sound.url = data.url;
          sound.bitrate = data.br ? `${data.br}kbps` : '';
          sound.platform = 'joox';
          success(sound);
        } else {
          failure(sound);
        }
      })
      .catch(() => failure(sound));
  }

  /** 获取歌词，走 GD API */
  static lyric(url) {
    const track_id = getParameterByName('track_id', url).slice(
      'jxtrack_'.length
    );
    const lyric_id = getParameterByName('lyric_url', url) || track_id;
    const target_url = `${this.gdApiUrl}?types=lyric&source=joox&id=${lyric_id}`;
    return {
      success: (fn) => {
        axios
          .get(target_url)
          .then((response) => {
            const { data } = response;
            fn({ lyric: data.lyric || '', tlyric: data.tlyric || '' });
          })
          .catch(() => fn({ lyric: '', tlyric: '' }));
      },
    };
  }

  // 以下为不支持的功能，返回空结果

  /** Joox 不支持歌单浏览 */
  static show_playlist() {
    return { success: (fn) => fn({ result: [] }) };
  }

  /** Joox 不支持歌单详情 */
  static get_playlist() {
    return { success: (fn) => fn({ tracks: [], info: {} }) };
  }

  /** Joox 不支持 URL 解析 */
  static parse_url() {
    return { success: (fn) => fn(undefined) };
  }

  /** Joox 不支持歌单筛选 */
  static get_playlist_filters() {
    return { success: (fn) => fn({ recommend: [], all: [] }) };
  }

  /** Joox 不支持用户登录 */
  static get_user() {
    return { success: (fn) => fn({ status: 'fail', data: {} }) };
  }

  /** Joox 不支持登录 */
  static get_login_url() {
    return '';
  }

  /** Joox 不支持登出 */
  static logout() {}
}
