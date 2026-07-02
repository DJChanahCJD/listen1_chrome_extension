/* global getParameterByName axios */
// eslint-disable-next-line no-unused-vars
class asmrmoon {
  /** Alist API 基础 URL */
  static apiBase = 'https://asmrmoon.com';

  /** 支持的音频文件扩展名 */
  static AUDIO_EXTENSIONS = [
    '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.wma',
    '.aac', '.opus', '.ape', '.aiff', '.webm',
  ];

  /** 判断文件名是否为音频文件 */
  static _isAudioFile(name) {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    return this.AUDIO_EXTENSIONS.includes(ext);
  }

  /**
   * 获取播放 URL，通过 Alist /api/fs/get 获取文件直链
   */
  static bootstrap_track(track, success, failure) {
    const sound = {};
    const filePath = decodeURIComponent(track.id.slice(2));

    axios
      .post(`${this.apiBase}/api/fs/get`, {
        path: filePath,
        password: '',
      })
      .then((response) => {
        const rawUrl = response.data?.data?.raw_url;
        if (rawUrl) {
          sound.url = rawUrl;
          sound.bitrate = '';
          sound.platform = 'asmrmoon';
          success(sound);
        } else {
          failure(sound);
        }
      })
      .catch(() => failure(sound));
  }

  /**
   * 搜索，通过 Alist /api/fs/search
   * type=0: 歌曲搜索（仅音频文件）
   * type=1: 歌单搜索（仅文件夹）
   */
  static search(url) {
    const keywords = getParameterByName('keywords', url);
    const curpage = parseInt(getParameterByName('curpage', url), 10) || 1;
    const searchType = getParameterByName('type', url) || '0';

    return {
      success: (fn) => {
        axios
          .post(`${this.apiBase}/api/fs/search`, {
            parent: '/',
            keywords,
            scope: searchType === '1' ? 1 : 2,
            page: curpage,
            per_page: 20,
            password: '',
          })
          .then((response) => {
            const content = response.data?.data?.content || [];
            const total = response.data?.data?.total ?? content.length;

            let result;
            if (searchType === '1') {
              // 歌单搜索：仅文件夹
              result = content
                .filter((f) => f.is_dir)
                .map((f) => {
                  const fullPath = `${f.parent || '/'}${(f.parent || '/').endsWith('/') ? '' : '/'}${f.name}`;
                  const encPath = encodeURIComponent(fullPath);
                  return {
                    id: `amdir_${encPath}`,
                    title: f.name,
                    source: 'asmrmoon',
                    source_url: `${this.apiBase}${fullPath}`,
                    img_url: '',
                    url: `amdir_${encPath}`,
                    author: f.parent || '/',
                    count: 0,
                  };
                });
            } else {
              // 歌曲搜索：仅音频文件
              result = content
                .filter((f) => !f.is_dir && this._isAudioFile(f.name))
                .map((f) => {
                  const parentDir = f.parent || '/';
                  const dirName =
                    parentDir
                      .replace(/^\/+|\/+$/g, '')
                      .split('/')
                      .pop() || 'ROOT';

                  return {
                    id: `am${encodeURIComponent(`${parentDir}/${f.name}`)}`,
                    title: f.name.replace(/\.[^.]+$/, ''),
                    artist: '',
                    artist_id: '',
                    album: dirName,
                    album_id: `amdir_${encodeURIComponent(parentDir)}`,
                    source: 'asmrmoon',
                    source_url: `${parentDir}/${f.name}`,
                    img_url: '',
                    disable: false,
                  };
                });
            }

            fn({ result, total, type: searchType });
          })
          .catch(() => {
            fn({ result: [], total: 0, type: searchType });
          });
      },
    };
  }

  /**
   * 获取歌词，尝试从同路径 .lrc 文件获取
   */
  static lyric(url) {
    const trackId = getParameterByName('track_id', url);
    const filePath = decodeURIComponent(trackId.slice(2));
    const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');

    return {
      success: (fn) => {
        axios
          .post(`${this.apiBase}/api/fs/get`, {
            path: lrcPath,
            password: '',
          })
          .then((response) => {
            const lrcUrl = response.data?.data?.raw_url;
            if (lrcUrl) {
              return axios.get(lrcUrl);
            }
            return Promise.reject();
          })
          .then((response) => {
            fn({ lyric: response.data, tlyric: '' });
          })
          .catch(() => {
            fn({ lyric: '', tlyric: '' });
          });
      },
    };
  }

  /** 歌单列表（不支持） */
  static show_playlist() {
    return { success: (fn) => fn({ result: [] }) };
  }

  /**
   * 歌单详情，根据 list_id 前缀分派
   * amdir_ → 列出目录下的音频文件
   */
  static get_playlist(url) {
    const listId = getParameterByName('list_id', url);
    const prefix = listId.split('_')[0];

    if (prefix === 'amdir') {
      return this._list_dir(url);
    }
    return { success: (fn) => fn({ info: {}, tracks: [] }) };
  }

  /**
   * 列出指定目录下的音频文件
   * 通过 Alist /api/fs/list 获取目录内容
   */
  static _list_dir(url) {
    const listId = getParameterByName('list_id', url);
    const dirPath = decodeURIComponent(listId.replace(/^amdir_/, ''));

    return {
      success: (fn) => {
        axios
          .post(`${this.apiBase}/api/fs/list`, {
            path: dirPath,
            password: '',
            page: 1,
            per_page: 0,
            refresh: false,
          })
          .then((response) => {
            const content = response.data?.data?.content || [];
            const tracks = content
              .filter((f) => !f.is_dir && this._isAudioFile(f.name))
              .map((f) => ({
                id: `am${encodeURIComponent(`${dirPath}/${f.name}`)}`,
                title: f.name.replace(/\.[^.]+$/, ''),
                artist: '',
                artist_id: '',
                album: dirPath
                  .replace(/^\/+|\/+$/g, '')
                  .split('/')
                  .pop() || 'ROOT',
                album_id: listId,
                source: 'asmrmoon',
                source_url: `${dirPath}/${f.name}`,
                img_url: '',
                disable: false,
              }));

            const dirName =
              dirPath
                .replace(/^\/+|\/+$/g, '')
                .split('/')
                .pop() || 'ROOT';
            fn({
              info: {
                cover_img_url: '',
                title: dirName,
                id: listId,
                source_url: `${this.apiBase}${dirPath}`,
              },
              tracks,
            });
          })
          .catch(() => {
            fn({
              info: {
                cover_img_url: '',
                title: '',
                id: listId,
                source_url: '',
              },
              tracks: [],
            });
          });
      },
    };
  }

  /** 歌单筛选（不支持） */
  static get_playlist_filters() {
    return { success: (fn) => fn({}) };
  }

  /** 解析分享链接（不支持） */
  static parse_url() {
    return { success: (fn) => fn(undefined) };
  }

  /** 获取用户信息（不支持登录） */
  static get_user() {
    return { success: (fn) => fn({ status: 'fail', data: {} }) };
  }

  /** 获取登录页 URL（不支持登录） */
  static get_login_url() {
    return '';
  }

  /** 登出（不支持登录） */
  static logout() {}
}
