# AGENTS.md — Listen1 Chrome Extension (Enhanced Fork)

本项目是一个跨平台音乐聚合播放器浏览器扩展（Chrome / Firefox / Edge），基于 AngularJS + 原生 JS 构建，无构建工具。
本分支在 [Listen1](https://github.com/listen1/listen1_chrome_extension) 基础上增加了**内置下载功能**和**免费音乐源**。

## 技术栈

- **前端框架**: AngularJS 1.x（非 Angular 2+）
- **音频引擎**: Howler.js
- **HTTP 客户端**: Axios
- **加密**: forge (listen1 fork)
- **国际化**: i18next
- **通知**: Notyf
- **快捷键**: hotkeys.js
- **异步**: async.js
- **缓存**: lru-cache (自定义 min 版)
- **无构建工具**: 所有 JS 通过 `<script>` 标签同步加载，无 bundler/webpack/vite
- **Manifest V3**: Chrome Extension Manifest V3

## 项目结构

```
├── listen1.html           # 唯一页面入口，所有 script 按顺序加载
├── manifest.json          # Chrome 扩展配置（Manifest V3）
├── rules_1.json           # declarativeNetRequest 规则（请求头改写）
├── js/
│   ├── app.js             # AngularJS 模块初始化、全局指令（拖拽、进度条、无限滚动等）
│   ├── background.js      # Service Worker：图标点击、消息监听
│   ├── bridge.js          # 前后台播放器通信桥（front/background 模式切换）
│   ├── l1_player.js       # 播放器门面（Facade），UI 层直接调用
│   ├── player_thread.js   # Player 类：实际播放逻辑、Howl 实例、播放队列、循环模式
│   ├── loweb.js           # MediaService：核心聚合层，分发请求到各 Provider
│   ├── lowebutil.js       # 工具函数：URL 参数、Cookie、localStorage 扩展、平滑滚动
│   ├── myplaylist.js      # 本地歌单管理（localStorage 存储）
│   ├── github.js          # GitHub Gist 歌单同步
│   ├── lastfm.js          # Last.fm scrobble 同步
│   ├── download.js        # 下载入口（全局函数，兼容 ng-click）
│   ├── download_manager.js # 下载管理器（队列、进度、UI 更新）
│   ├── oauth_callback.js  # OAuth 回调处理（content script）
│   ├── controller/        # AngularJS 控制器
│   │   ├── play.js            # 播放页
│   │   ├── playlist.js        # 歌单详情页
│   │   ├── my_playlist.js     # 我的歌单
│   │   ├── navigation.js      # 路由/导航
│   │   ├── instant_search.js  # 即时搜索
│   │   ├── platform.js        # 平台视图
│   │   ├── auth.js            # 登录授权
│   │   └── profile.js         # 用户设置
│   ├── provider/          # 音乐平台 Provider（每个平台一个文件）
│   │   ├── netease.js     # 网易云 (id: 'ne')
│   │   ├── qq.js          # QQ 音乐 (id: 'qq')
│   │   ├── kugou.js       # 酷狗 (id: 'kg')
│   │   ├── kuwo.js        # 酷我 (id: 'kw')
│   │   ├── bilibili.js    # Bilibili (id: 'bi')
│   │   ├── migu.js        # 咪咕 (id: 'mg')
│   │   ├── taihe.js       # 千千音乐 (id: 'th')
│   │   ├── gdnetease.js   # GD网易云 (id: 'gn')，搜索/歌单/歌词委托netease，仅音频URL走GD API
│   │   ├── joox.js        # Joox (id: 'jx')，全功能走GD API
│   │   ├── xiaoqiu.js     # 小秋音乐 (id: 'xq')，免费源
│   │   ├── xiaowo.js      # 小窝音乐 (id: 'xw')，免费源
│   │   ├── asmrgay.js     # ASMR GAY (id: 'ag')，Alist API，免费源
│   │   ├── localmusic.js  # 本地音乐 (id: 'lm', hidden)
│   │   └── xiami.js       # 虾米 (id: 'xm', hidden, 已停用)
│   └── vendor/            # 第三方库（min 版）
├── css/                   # 样式文件（多主题）
│   ├── origin.css / origin2.css     # 白色主题
│   ├── iparanoid.css / iparanoid2.css # 暗色主题
│   ├── common.css / common2.css     # 通用样式
│   ├── player.css         # 播放器样式
│   ├── cover.css          # 封面样式
│   └── icon.css           # 图标样式
├── i18n/                  # 国际化翻译文件
│   ├── zh-CN.json
│   ├── zh-TC.json
│   ├── en-US.json
│   ├── fr-FR.json
│   ├── ko-KR.json
│   └── pt-BR.json
└── images/                # 图标和图片资源
```

## 核心架构

### 数据流

```
用户操作 → AngularJS Controller → MediaService (loweb.js) → Provider (各平台)
                                                            ↓
                                          返回歌曲/歌单/URL 数据
                                                            ↓
用户操作 → l1Player (门面) → bridge.js → Player (player_thread.js) → Howler.js → 音频输出
```

### 播放器双模式

- **front 模式**: 播放器与 UI 在同一环境（Electron 或开启"关闭时停止播放"时）
- **background 模式**: 播放器在 Service Worker 中，通过 `chrome.runtime.sendMessage` 通信

模式选择逻辑：`isElectron() || enable_stop_when_close === true` → front，否则 background。

### Provider 接口约定

每个 Provider 必须实现以下方法（按需）：

| 方法 | 说明 |
|------|------|
| `search(url)` | 搜索歌曲，返回 `{ success: (fn) => fn(result) }` |
| `show_playlist(url)` | 获取平台歌单列表 |
| `get_playlist(url)` | 获取歌单详情 |
| `lyric(url)` | 获取歌词 |
| `bootstrap_track(track, successCb, failCb)` | 获取播放 URL |
| `parse_url(url)` | 解析分享链接 |
| `login(url)` | 登录 |
| `get_user()` | 获取用户信息 |
| `logout()` | 登出 |

返回值格式统一为 `{ success: (fn) => fn(data) }` 回调风格。

### 歌曲唯一标识

格式：`{provider_id前2位}{平台原始id}`。例如 `ne12345` = 网易云，`qq67890` = QQ 音乐。

Provider ID 映射：`ne`=网易、`qq`=QQ、`kg`=酷狗、`kw`=酷我、`bi`=B站、`mg`=咪咕、`th`=千千、`gn`=GD网易、`jx`=Joox、`xq`=小秋、`xw`=小窝、`ag`=ASMR GAY、`lm`=本地、`my`=我的歌单、`xm`=虾米。

### 自动切换播放源（Failover）

`MediaService.bootstrapTrack` 实现了播放源自动切换：
1. 先用歌曲原始平台获取 URL
2. 失败后，按 `auto_choose_source_list` 配置（默认 `['kuwo', 'qq', 'migu']`）依次搜索其他平台
3. 匹配条件：`title === track.title && artist === track.artist`
4. 使用 `Promise.all` + `reject` 技巧实现"任一成功即返回"

### 下载模块

文件 `download.js` 和 `download_manager.js` 实现了内置下载功能：

- `downloadSong(track)` — 全局函数，兼容 UI 层 `ng-click` 调用，将歌曲加入队列
- `downloadManager` — 下载管理器（单例），维护顺序任务队列（1 并发）
  - 使用 `fetch` + `ReadableStream` 实现带进度下载
  - 通过 `$rootScope.$applyAsync` 触发 AngularJS UI 更新（进度条、状态切换）
  - 支持暂停/取消/批量下载/重试
  - 文件名规则：`{Artist} - {Title}.{format}`

下载模块为纯增量代码，不侵入原有播放逻辑。加载顺序在 `app.js` 之前。`downloadSong` 保持全局函数签名，避免重构现有控制器。

## 编码约定

### 全局变量

项目无模块系统，所有模块通过全局变量暴露，依赖 `/* global */` 注释声明：

```js
/* global l1Player MediaService downloadManager */
/* global netease qq kugou kuwo bilibili migu taihe gdnetease joox xiaoqiu xiaowo asmrgay localmusic myplaylist */
```

修改时需注意 script 加载顺序（见 `listen1.html`），后加载的文件可引用先加载的全局变量。

### 回调风格

异步操作统一使用 `{ success: (fn) => fn(data) }` 回调模式，非 Promise。新增 Provider 方法必须遵循此模式。

### localStorage 使用

通过 `lowebutil.js` 扩展的原型方法：
- `localStorage.getObject(key)` — 获取并 JSON.parse
- `localStorage.setObject(key, value)` — JSON.stringify 并存储

歌单数据全部存储在 localStorage 中，key 为歌单 ID。

### 循环模式

- `0` = 顺序播放（all）
- `1` = 单曲循环（one）
- `2` = 随机播放（shuffle）

### 国际化

使用 i18next，翻译键以下划线开头（如 `_NETEASE_MUSIC`），翻译文件在 `i18n/` 目录。

### CSS 主题

支持白色/黑色两种主题，通过切换 CSS 文件实现。`origin*.css` + `common*.css` 为白，`iparanoid*.css` + `common2.css` 为暗。

## 修改指南

### 添加新音乐平台

1. 在 `js/provider/` 下创建新文件，实现 Provider 接口
2. 在 `loweb.js` 的 `PROVIDERS` 数组中注册（含 name, instance, searchable, support_login, id）
3. 在 `app.js` 的 `sourceList` 中添加显示名
4. 在 `listen1.html` 中添加 `<script>` 标签（在 `loweb.js` 之前）
5. 在 `manifest.json` 的 `host_permissions` 中添加平台域名
6. 在 `rules_1.json` 中添加请求头改写规则（如需要）
7. 在各 `i18n/*.json` 中添加平台显示名翻译

### 添加新 Controller

1. 在 `js/controller/` 下创建文件
2. 在 `listen1.html` 中添加 `<script>` 标签
3. 在 HTML 中通过 `ng-controller` 绑定

### 修改播放逻辑

- UI 层操作 → 修改 `l1_player.js`（门面）
- 实际播放行为 → 修改 `player_thread.js`（Player 类）
- 前后台通信 → 修改 `bridge.js`

## 注意事项

- **无构建流程**: 不能使用 ES Module import/export、TypeScript、JSX 等。所有代码必须是浏览器可直接执行的 JS。
- **全局作用域**: 所有模块通过全局变量通信，注意命名冲突。
- **Script 加载顺序**: `listen1.html` 中的 script 顺序即为依赖顺序，不可随意调换。
- **localStorage 容量**: 歌单数据存储在 localStorage，有 5MB（Chrome）/ 10MB（Firefox）限制。扩展声明了 `unlimitedStorage` 权限。
- **加密算法**: 网易云等平台的 API 请求使用了 AES/RSA 加密（通过 forge 库），修改 Provider 时需理解对应平台的加密协议。
- **CORS**: 扩展通过 `host_permissions` 和 `declarativeNetRequest` 绕过 CORS 限制。
