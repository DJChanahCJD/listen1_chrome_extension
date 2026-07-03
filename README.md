# Listen1 增强版

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)

基于 [Listen1](https://github.com/listen1/listen1_chrome_extension) 的现代化增强分支，**内置下载功能 + 免费音乐源支持**。

<img width="849" height="399" alt="image" src="https://github.com/user-attachments/assets/a3ff7650-04c1-4a77-afd4-5d2d70e72a25" />



## 新增特性

- **内置下载** — 歌曲一键下载，支持进度显示、批量下载
- **免费 Provider** — 新增小秋、小窝、ASMR GAY、ASMR Moon、ASMR.one、网易云（GD）、Joox 共 7 个免费音乐源
- **播客支持** — iTunes 播客搜索 + Apple Podcasts 多国排行榜，支持分类浏览

## 支持的音乐平台

| Provider | ID | 说明 |
|----------|----|------|
| 网易云音乐 | ne | |
| QQ 音乐 | qq | |
| 酷狗音乐 | kg | |
| 酷我音乐 | kw | |
| Bilibili | bi | |
| 咪咕音乐 | mg | |
| 千千音乐 | th | |
| 网易云（GD）| gn | 基于 GD Studio's API |
| Joox | jx | 基于 GD Studio's API |
| 小秋音乐 | xq | 免费源 (需网络可用) |
| 小窝音乐 | xw | 免费源 (需网络可用) |
| ASMR GAY | ag | 免费源，基于 Alist API |
| ASMR Moon | am | 免费源，基于 Alist API |
| ASMR.one | ao | 免费源，基于 asmr-300 API (支持 guest 登录) |
| 播客 | po | Apple Podcasts 排行榜 + iTunes 搜索 + RSS Feed |

## 安装

### Chrome
1. 下载本项目 ZIP 并解压
2. 打开 `chrome://extensions`
3. 开启"开发者模式"，点击"加载已解压的扩展程序"
4. 选择解压后的文件夹

### Firefox
1. 将 `manifest_firefox.json` 替换为 `manifest.json`
2. 打包：`zip -r ../listen1.xpi *`
3. 在 Firefox 中加载 xpi 文件

## 下载功能

- 歌曲页面点击下载按钮加入下载队列
- 下载管理器（右下角图标）显示进度、暂停、取消
- 批量和单曲下载均支持
- 文件命名规则：`{艺术家} - {歌名}.{格式}`

## 项目结构

```
├── js/
│   ├── download.js            # 下载入口（全局函数，兼容 ng-click）
│   ├── download_manager.js    # 下载管理器（队列、进度、并发控制）
│   ├── provider/
│   │   ├── xiaoqiu.js         # 小秋音乐 (id: xq)
│   │   ├── xiaowo.js          # 小窝音乐 (id: xw)
│   │   ├── asmrgay.js         # ASMR GAY (id: ag)
│   │   ├── gdnetease.js       # GD 网易云 (id: gn)
│   │   ├── joox.js            # Joox (id: jx)
│   │   └── ...                # 其余同原版
│   └── ...
├── manifest.json              # MV3 配置
└── ...
```

## License

MIT
