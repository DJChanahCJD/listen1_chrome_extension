# Listen1 Enhanced

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)

A modernized fork of [Listen1](https://github.com/listen1/listen1_chrome_extension) — **built-in download support + free music providers**.

> Listen1 is a cross-platform music aggregator browser extension that lets you search and play music from multiple Chinese platforms.
> This fork adds download capabilities and additional free music sources.

## Key Features

- **Built-in Download** — One-click song download with progress tracking, batch download, custom filenames
- **Free Providers** — Xiaoqiu, Xiaowo and other free music sources
- **GD API Support** — Netease and Joox playback via GD API fallback

## Supported Platforms

| Provider | ID | Note |
|----------|----|------|
| Netease | ne | Native + GD API (gdnetease) |
| QQ Music | qq | |
| Kugou | kg | |
| Kuwo | kw | |
| Bilibili | bi | |
| Migu | mg | |
| Taihe (Qianqian) | th | |
| Joox | jx | Via GD API |
| Xiaoqiu | xq | Free source |
| Xiaowo | xw | Free source |

## Install

### Chrome
1. Download ZIP and extract
2. Open `chrome://extensions`
3. Enable "Developer mode", click "Load unpacked"
4. Select the extracted folder

### Firefox
1. Replace `manifest.json` with `manifest_firefox.json`
2. Package: `zip -r ../listen1.xpi *`
3. Load xpi file in Firefox

## Download Feature

- Click download button on any song to add to download queue
- Download manager (bottom-right icon) shows progress, pause, cancel
- Supports batch and single downloads
- File naming: `{Artist} - {Title}.{format}`

## License

MIT
