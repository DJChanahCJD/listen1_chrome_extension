/* global downloadManager */

/**
 * 下载指定歌曲（委托给 downloadManager，加入下载队列）
 * 保留原函数签名以兼容现有 6 处 ng-click="downloadSong(song)" 调用
 * @param {Object} track - 歌曲对象，需包含 id, title, artist, source 等字段
 * @param {string} [customFilename] - 保留参数兼容，目前由 manager 生成文件名
 */
function downloadSong(track, customFilename) {
  if (!track || !track.id) return;
  downloadManager.enqueue(track);
}
