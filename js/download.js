/* global MediaService notyf i18next */

/**
 * 下载指定歌曲
 * 通过 MediaService.bootstrapTrack 获取播放 URL，
 * 然后用 fetch 拉取二进制 → Blob → 创建临时 URL → 触发 <a download>
 * @param {Object} track - 歌曲对象，需包含 id, title, artist, source 等字段
 * @param {string} [customFilename] - 可选的自定义文件名
 */
function downloadSong(track, customFilename) {
  if (!track || !track.id) return;

  notyf.info(i18next.t('_PREPARING_DOWNLOAD'), true);

  MediaService.bootstrapTrack(
    track,
    (response) => {
      if (!response || !response.url) {
        notyf.error(i18next.t('_DOWNLOAD_FAILED'), true);
        return;
      }
      const filename =
        customFilename ||
        `${track.artist} - ${track.title}.mp3`.replace(/[/\\?*:|"<>]/g, '_');

      // fetch 拉取二进制 → Blob → 临时 URL → 触发下载
      fetch(response.url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(blobUrl);
          notyf.success(i18next.t('_DOWNLOAD_STARTED'), true);
        })
        .catch(() => {
          notyf.error(i18next.t('_DOWNLOAD_FAILED'), true);
        });
    },
    () => {
      notyf.error(i18next.t('_DOWNLOAD_FAILED'), true);
    }
  );
}
