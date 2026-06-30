/* global MediaService notyf i18next angular */
/**
 * 全局下载管理器：维护下载队列、进度、状态
 * 顺序处理（1 并发），通过 $rootScope.$applyAsync 触发 UI 更新
 */
const downloadManager = (() => {
  let nextId = 1;
  const tasks = [];
  let processing = false;

  /**
   * 通知 AngularJS 触发脏检查，刷新浮动面板 UI
   */
  function notify() {
    try {
      const root = angular.element(document).injector().get('$rootScope');
      root.$applyAsync();
    } catch (e) {
      // injector 尚未就绪，忽略
    }
  }

  /**
   * 根据歌曲信息生成安全的 mp3 文件名
   * @param {Object} track - 歌曲对象
   * @returns {string} 处理后的文件名
   */
  function makeFilename(track) {
    return `${track.artist} - ${track.title}.mp3`.replace(
      /[/\\?*:|"<>]/g,
      '_'
    );
  }

  /**
   * 触发浏览器下载：Blob → 临时 URL → <a download>
   * @param {Blob} blob - 二进制数据
   * @param {string} filename - 保存文件名
   */
  function triggerBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * 处理单个下载任务：bootstrapTrack 拿 URL → fetch 流式读取 → blob 触发保存
   * @param {Object} task - 任务对象
   * @returns {Promise<void>}
   */
  function downloadOne(task) {
    task.status = 'downloading';
    task.progress = 0;
    notify();
    return new Promise((resolve) => {
      MediaService.bootstrapTrack(
        task.track,
        async (response) => {
          if (!response || !response.url) {
            task.status = 'failed';
            task.error = 'no_url';
            notify();
            resolve();
            return;
          }
          try {
            const res = await fetch(response.url, {
              signal: task.abortCtrl.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const total = +res.headers.get('Content-Length') || 0;
            const reader = res.body.getReader();
            const chunks = [];
            let received = 0;
            // 循环读取流，更新进度；Content-Length 缺失时 progress 置 -1
            while (true) {
              const { done, value } = await reader.read(); // eslint-disable-line no-await-in-loop
              if (done) break;
              chunks.push(value);
              received += value.length;
              task.progress = total
                ? Math.min(99, Math.round((received / total) * 100))
                : -1;
              notify();
            }
            const blob = new Blob(chunks);
            triggerBlob(blob, task.filename);
            task.status = 'done';
            task.progress = 100;
            notify();
          } catch (err) {
            if (err.name === 'AbortError') {
              task.status = 'canceled';
            } else {
              task.status = 'failed';
              task.error = err.message;
            }
            notify();
          }
          resolve();
        },
        () => {
          task.status = 'failed';
          task.error = 'bootstrap_fail';
          notify();
          resolve();
        }
      );
    });
  }

  /**
   * 顺序处理队列：1 并发，避免触发平台限流
   */
  async function processQueue() {
    if (processing) return;
    processing = true;
    while (tasks.some((t) => t.status === 'queued')) {
      const task = tasks.find((t) => t.status === 'queued');
      if (!task) break;
      await downloadOne(task); // eslint-disable-line no-await-in-loop
    }
    processing = false;
  }

  /**
   * 判断歌曲是否已在活跃队列中（去重）
   * @param {Object} track - 歌曲对象
   * @returns {boolean}
   */
  function isActiveInQueue(track) {
    return tasks.some(
      (t) =>
        t.track.id === track.id &&
        t.status !== 'done' &&
        t.status !== 'failed' &&
        t.status !== 'canceled'
    );
  }

  /**
   * 单首入队
   * @param {Object} track - 歌曲对象
   */
  function enqueue(track) {
    if (!track || !track.id) return;
    if (isActiveInQueue(track)) return;
    tasks.push({
      id: nextId++,
      track,
      status: 'queued',
      progress: 0,
      filename: makeFilename(track),
      abortCtrl: new AbortController(),
    });
    notyf.info(i18next.t('_DOWNLOAD_QUEUED', { title: track.title }), true);
    processQueue();
  }

  /**
   * 批量入队
   * @param {Array<Object>} tracks - 歌曲数组
   */
  function enqueueBatch(tracks) {
    const valid = tracks.filter((t) => t && t.id);
    valid.forEach((track) => {
      if (isActiveInQueue(track)) return;
      tasks.push({
        id: nextId++,
        track,
        status: 'queued',
        progress: 0,
        filename: makeFilename(track),
        abortCtrl: new AbortController(),
      });
    });
    if (valid.length > 0) {
      notyf.info(
        i18next.t('_N_SONGS_QUEUED', { count: valid.length }),
        true
      );
    }
    processQueue();
  }

  /**
   * 取消任务：下载中调用 abort，排队中直接标记 canceled
   * @param {number} taskId - 任务 ID
   */
  function cancel(taskId) {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (t.status === 'downloading') {
      t.abortCtrl.abort();
    } else if (t.status === 'queued') {
      t.status = 'canceled';
      notify();
    }
  }

  /**
   * 清空已完成/失败/取消的任务
   */
  function clearCompleted() {
    for (let i = tasks.length - 1; i >= 0; i -= 1) {
      if (['done', 'failed', 'canceled'].includes(tasks[i].status)) {
        tasks.splice(i, 1);
      }
    }
    notify();
  }

  return {
    tasks,
    enqueue,
    enqueueBatch,
    cancel,
    clearCompleted,
  };
})();
