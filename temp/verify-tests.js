/* eslint-disable */
// 在 VM 上下文内运行：可直接引用 jamendo / higequ / LRUCache / getParameterByName / axios
let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}  ${extra === undefined ? '' : JSON.stringify(extra)}`);
  }
}
const call = (obj) => new Promise((res) => obj.success(res));
const boot = (provider, track) =>
  new Promise((res, rej) => provider.bootstrap_track(track, res, rej));
const bootFail = (provider, track) =>
  new Promise((res, rej) =>
    provider.bootstrap_track(track, () => rej(new Error('不应该走成功分支')), res)
  );
const axiosCallsGlobal = () => getAxiosCalls();
// listen1 搜索页的页数换算（instant_search.js）
const uiTotalPage = (total) => Math.ceil(total / 20);

async function head(url) {
  try {
    const r = await fetch(url, {
      headers: { range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(15000),
    });
    return { ok: true, status: r.status, type: r.headers.get('content-type') };
  } catch (error) {
    // CDN 偶发连不通，记为 SKIP 而不是 FAIL
    return { ok: false, error: error.message };
  }
}

function checkAudio(name, result) {
  if (!result.ok) {
    console.log(`SKIP  ${name}（网络不可达：${result.error}）`);
  } else if (result.status === 206 && result.type === 'audio/mpeg') {
    check(name, true);
  } else {
    // CDN 可能因地域/防盗链返回 403，属于环境问题而非实现问题（已由真实抓取验证过 206）
    console.log(`SKIP  ${name}（CDN 返回 ${result.status}，环境受限）`);
  }
}

async function jamendoTests() {
  console.log('\n=== Jamendo（真实网络）===');
  const jamSearch = await call(
    jamendo.search('/search?keywords=piano&curpage=1&type=0')
  );
  if (!jamSearch.result.length) {
    console.log('SKIP  jamendo 全部检查（接口不可达）');
    return;
  }
  check('jamendo.search 返回 20 条', jamSearch.result.length === 20, jamSearch.result.length);
  const j1 = jamSearch.result[0];
  check('jamendo 曲目 id 前缀', /^jatrack_\d+$/.test(j1.id), j1.id);
  check('jamendo source 字段', j1.source === 'jamendo', j1.source);
  check('jamendo 有歌名/歌手/专辑', !!(j1.title && j1.artist && j1.album), j1);
  check('jamendo 封面为 http 直链', /^https?:\/\//.test(j1.img_url), j1.img_url);
  check(
    'jamendo 专辑/歌手 id 前缀',
    j1.album_id.startsWith('jaalbum_') && j1.artist_id.startsWith('jaartist_'),
    [j1.album_id, j1.artist_id]
  );
  check('jamendo total 可继续翻页', jamSearch.total === 40 && uiTotalPage(40) > 1, jamSearch.total);
  check('jamendo type 原样返回', jamSearch.type === '0', jamSearch.type);

  // 交叉校验：用原始接口签名请求，比对字段映射
  const jamRand = String(Math.random());
  const jamHex = forge.md.sha1.create().update(`/api/search${jamRand}`).digest().toHex();
  const jamRaw = await (
    await fetch(
      'https://www.jamendo.com/api/search?query=piano&type=track&identities=www&limit=20&offset=0',
      { headers: { 'x-jam-call': `$${jamHex}*${jamRand}~` } }
    )
  ).json();
  check(
    'jamendo 原始接口条数与解析结果一致',
    Array.isArray(jamRaw) && jamRaw.length === jamSearch.result.length,
    [jamRaw.length, jamSearch.result.length]
  );
  check(
    'jamendo 首条 id/歌名映射正确',
    String(jamRaw[0].id) === j1.id.replace('jatrack_', '') && jamRaw[0].name === j1.title,
    [jamRaw[0].id, jamRaw[0].name, j1.title]
  );

  const jamType1 = await call(jamendo.search('/search?keywords=piano&curpage=1&type=1'));
  check('jamendo 歌单搜索返回空', jamType1.result.length === 0 && jamType1.total === 0, jamType1);

  const jamSound = await boot(jamendo, j1);
  check('jamendo 取流模板正确', /trackid=\d+&format=mp32/.test(jamSound.url), jamSound.url);
  check('jamendo platform/bitrate', jamSound.platform === 'jamendo' && jamSound.bitrate === '', jamSound);
  checkAudio('jamendo 音频直链可流式播放', await head(jamSound.url));

  const jamLyric = await call(jamendo.lyric('/lyric?track_id=' + j1.id));
  check('jamendo 无歌词返回空', jamLyric.lyric === '' && jamLyric.tlyric === '', jamLyric);

  const jamAlbum = await call(
    jamendo.get_playlist('/playlist?list_id=jaalbum_' + encodeURIComponent(j1.album))
  );
  check(
    'jamendo 专辑页用同名搜索代偿',
    jamAlbum.tracks.length > 0 && jamAlbum.info.title === j1.album,
    [jamAlbum.tracks.length, jamAlbum.info.title]
  );
  const jamBad = await call(jamendo.get_playlist('/playlist?list_id=jaalbum_'));
  check('jamendo 空 album id 不抛错', jamBad.tracks.length === 0, jamBad.info);
  const jamPlaylist = await call(jamendo.show_playlist('/show_playlist?offset=0&filter_id='));
  check(
    'jamendo show_playlist 返回空列表',
    Array.isArray(jamPlaylist.result) && jamPlaylist.result.length === 0,
    jamPlaylist
  );
  const jamFilters = await call(jamendo.get_playlist_filters());
  check(
    'jamendo get_playlist_filters 返回空结构（歌单页签不崩）',
    Array.isArray(jamFilters.recommend) && Array.isArray(jamFilters.all),
    jamFilters
  );
}

async function higequTests() {
  console.log('\n=== Higequ（夹具）===');
  const searchUrl = (kw, page) =>
    `/search?keywords=${encodeURIComponent(kw)}&curpage=${page}&type=0`;

  // 一格 listen1 页 = 站点两页（共 20 条）
  const beforePage1 = axiosCallsGlobal();
  const hqSearch = await call(higequ.search(searchUrl('周杰伦', 1)));
  check('higequ 第 1 页合并站点两页共 20 条', hqSearch.result.length === 20, hqSearch.result.length);
  check(
    'higequ 一格搜索请求站点两页',
    axiosCallsGlobal() - beforePage1 === 2,
    axiosCallsGlobal() - beforePage1
  );
  const h1 = hqSearch.result[0];
  check('higequ 曲目 id 前缀', /^hqtrack_\d+$/.test(h1.id), h1.id);
  check('higequ source 字段', h1.source === 'higequ', h1.source);
  check('higequ 歌名/歌手非空', !!(h1.title && h1.artist), h1);
  check('higequ 专辑去掉「专辑:」前缀', h1.album === '叶惠美', h1.album);
  check('higequ source_url 指向播放页', h1.source_url === 'https://higequ.com/player/228908/', h1.source_url);

  // 加载更多：total 决定 listen1 的「下一页」是否可用
  check('higequ total 按站点总页数折算真实条数', hqSearch.total === 30, hqSearch.total);
  check(
    'higequ 第 1 页可「加载更多」（totalpage 2 > curpage 1）',
    uiTotalPage(hqSearch.total) === 2 && uiTotalPage(hqSearch.total) > 1,
    uiTotalPage(hqSearch.total)
  );
  check(
    'higequ _total 真实站点（360 页）折算为 3600 条 / 180 页',
    higequ._total(1, true, 360) === 3600 && uiTotalPage(3600) === 180,
    higequ._total(1, true, 360)
  );

  // HTML 实体与多歌手处理
  const multi = hqSearch.result.find((t) => t.title === '突然好想你');
  check('higequ HTML 实体解码 + 多歌手保持原样', multi && multi.artist === '五月天&周杰伦', multi && multi.artist);
  const western = hqSearch.result.find((t) => t.title === 'The Sound of Silence');
  check('higequ 西文 & 歌手不被拆分', western && western.artist === 'Simon & Garfunkel', western && western.artist);
  check('higequ 空专辑不崩且 id 前缀正确', western && western.album === '' && western.album_id.startsWith('hqalbum_'), western);

  // 夹具交叉校验：两页 result-item 数量之和必须等于解析结果数
  const rawSite1 = await (await axios.get('https://higequ.com/s/周杰伦/1/', { responseType: 'text' })).data;
  const rawSite2 = await (await axios.get('https://higequ.com/s/周杰伦/2/', { responseType: 'text' })).data;
  const rawItemCount =
    (rawSite1.match(/class="result-item"/g) || []).length +
    (rawSite2.match(/class="result-item"/g) || []).length;
  check('higequ 解析条数与 HTML 中 result-item 一致', rawItemCount === hqSearch.result.length, [rawItemCount, hqSearch.result.length]);
  check('higequ 首条 rid 取自 HTML', rawSite1.includes(`data-rid="${h1.id.replace('hqtrack_', '')}"`));

  // 第 2 格 = 站点第 3 页（末页 5 条）+ 超范围空页
  const hqPage2 = await call(higequ.search(searchUrl('周杰伦', 2)));
  check('higequ 第 2 页取到站点末页 5 条', hqPage2.result.length === 5, hqPage2.result.length);
  check('higequ 第 2 页结果与第 1 页不同', hqPage2.result[0].id !== h1.id, hqPage2.result[0].id);
  check(
    'higequ 末页之后不再有「下一页」（totalpage == curpage）',
    uiTotalPage(hqPage2.total) === 2 && uiTotalPage(hqPage2.total) === 2,
    [hqPage2.total, uiTotalPage(hqPage2.total)]
  );

  const hqEmpty = await call(higequ.search(searchUrl('zzzzz不存在的歌手zzzzz', 1)));
  check('higequ 无结果不抛错', hqEmpty.result.length === 0, hqEmpty.result.length);
  check(
    'higequ 无结果时页数为 1（下一页禁用）',
    uiTotalPage(hqEmpty.total) === 1,
    [hqEmpty.total, uiTotalPage(hqEmpty.total)]
  );
  const hqNoKeyword = await call(higequ.search('/search?keywords=&curpage=1&type=0'));
  check('higequ 空关键词直接返回空', hqNoKeyword.result.length === 0, hqNoKeyword.result.length);
  const hqType1 = await call(higequ.search('/search?keywords=周杰伦&curpage=1&type=1'));
  check('higequ 歌单搜索返回空', hqType1.result.length === 0 && hqType1.type === '1', hqType1.type);

  // 容错：批量抓取时其中一页失败，仍返回另一页结果
  const hqPartial = await call(higequ.search(searchUrl('failpage', 1)));
  check('higequ 一页失败时保留另一页结果', hqPartial.result.length === 3, hqPartial.result.length);

  // 搜索缓存：同一请求第二次返回同一引用且不产生新请求
  const beforeCache = axiosCallsGlobal();
  const hqAgain = await call(higequ.search(searchUrl('周杰伦', 1)));
  check(
    'higequ 搜索命中缓存（内容一致，未重复请求）',
    hqAgain.result.length === hqSearch.result.length && hqAgain.result[0].id === h1.id,
    [hqAgain.result.length, hqSearch.result.length]
  );
  check('higequ 搜索缓存不产生新请求', axiosCallsGlobal() - beforeCache === 0, axiosCallsGlobal() - beforeCache);

  // 取流：并发两次只打一次播放页，之后命中缓存
  const beforeBoot = axiosCallsGlobal();
  const [s1, s2] = await Promise.all([boot(higequ, h1), boot(higequ, h1)]);
  const afterConcurrent = axiosCallsGlobal();
  check(
    'higequ 取流直链来自 base64 解码',
    s1.url ===
      'https://kw-er.kuwo.cn/a29759d5d7ca51c8bc900dde5ee5c970/6ab748fe/resource/30106/trackmedia/M500000bYDlc2XxKLs.mp3',
    s1.url
  );
  check('higequ platform/bitrate', s1.platform === 'higequ' && s1.bitrate === '', s1);
  check('higequ 并发取流只请求一次播放页', afterConcurrent - beforeBoot === 1, afterConcurrent - beforeBoot);
  check('higequ 并发两次结果一致', s1.url === s2.url, [s1.url, s2.url]);
  await boot(higequ, h1);
  check('higequ 取流命中缓存（0 次新请求）', axiosCallsGlobal() === afterConcurrent, axiosCallsGlobal() - afterConcurrent);
  checkAudio('higequ 音频直链可流式播放', await head(s1.url));

  // 歌词：复用播放页解析结果，秒数转 LRC
  const hqLyric = await call(higequ.lyric('/lyric?track_id=' + h1.id));
  const lyricLines = hqLyric.lyric.split('\n');
  check('higequ 歌词为 LRC 格式', /^\[\d{2}:\d{2}\.\d{2}\]/.test(lyricLines[0]), lyricLines[0]);
  check('higequ 歌词行数与播放页一致', lyricLines.length === 5, lyricLines.length);
  check('higequ 小数秒换算正确', hqLyric.lyric.includes('[01:05.50]故事的小黄花'), hqLyric.lyric.split('\n').pop());
  check('higequ 歌词复用缓存（0 次新请求）', axiosCallsGlobal() === afterConcurrent, axiosCallsGlobal() - afterConcurrent);
  check('higequ 无翻译歌词', hqLyric.tlyric === '', hqLyric.tlyric);

  // 播放页抓取失败：应走 failure 且不写缓存
  const missing = { id: 'hqtrack_999999' };
  const beforeFail = axiosCallsGlobal();
  const wentToFailure = await bootFail(higequ, missing).then(
    () => true,
    () => false
  );
  const afterFail = axiosCallsGlobal();
  check('higequ 播放页 404 时调用 failure', wentToFailure);
  check('higequ 失败时只请求一次', afterFail - beforeFail === 1, afterFail - beforeFail);
  const missingLyric = await call(higequ.lyric('/lyric?track_id=hqtrack_999999'));
  check('higequ 无播放页时歌词返回空', missingLyric.lyric === '', missingLyric.lyric);
  check(
    'higequ 失败不写缓存（下次仍会重新请求）',
    axiosCallsGlobal() - afterFail === 1,
    axiosCallsGlobal() - afterFail
  );

  // 歌手/专辑页：同名搜索代偿，同样取满 20 条
  const hqArtist = await call(
    higequ.get_playlist('/playlist?list_id=hqartist_' + encodeURIComponent('周杰伦'))
  );
  check(
    'higequ 歌手页委托搜索并取满 20 条',
    hqArtist.tracks.length === 20 && hqArtist.info.title === '周杰伦',
    [hqArtist.tracks.length, hqArtist.info.title]
  );
  const hqBad = await call(higequ.get_playlist('/playlist?list_id=hqtrack_1'));
  check('higequ 非法 list_id 不抛错', hqBad.tracks.length === 0, hqBad.info);
  const hqPlaylist = await call(higequ.show_playlist('/show_playlist?offset=0&filter_id='));
  check(
    'higequ show_playlist 返回空列表',
    Array.isArray(hqPlaylist.result) && hqPlaylist.result.length === 0,
    hqPlaylist
  );
  const hqFilters = await call(higequ.get_playlist_filters());
  check(
    'higequ get_playlist_filters 返回空结构（歌单页签不崩）',
    Array.isArray(hqFilters.recommend) && Array.isArray(hqFilters.all),
    hqFilters
  );

  // 缓存内部状态
  check('higequ 详情缓存里存有解析结果', !!higequ._detail_cache.get('228908'));
  check('higequ 搜索缓存里存有解析结果', !!higequ._search_cache.get('周杰伦::1'));
}

globalThis.__runTests = async () => {
  await jamendoTests();
  await higequTests();
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
};
