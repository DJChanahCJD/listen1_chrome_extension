# Listen1 Enhanced

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)

A modernized fork of [Listen1](https://github.com/listen1/listen1_chrome_extension) — **built-in download support + free music providers**.

> Listen1 is a cross-platform music aggregator browser extension that lets you search and play music from multiple Chinese platforms.
> This fork adds download capabilities and additional free music sources.

## Key Features

- **Built-in Download** — One-click song download with progress tracking, batch download, custom filenames
- **Free Providers** — Xiaoqiu, Xiaowo, ASMR GAY, ASMR Moon, ASMR.one and other free music sources (7 total)
- **Podcast Support** — iTunes podcast search + RSS feed parsing, curated Chinese podcast shows
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
| ASMR GAY | ag | Free source (Alist API) |
| ASMR Moon | am | Free source (Alist API) |
| ASMR.one | ao | Free source (asmr-300 API, guest login supported) |
| Podcast | po | iTunes search + RSS feeds, curated podcast shows |

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
