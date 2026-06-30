# Listen 1 (Chrome Extension) V2.33.0

（最后更新于 2025 年 6 月 17 日）

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)

[English Version](https://github.com/listen1/listen1_chrome_extension/blob/master/README_EN.md)

## 缘起

当我发现找个想听的歌因为版权听不了，需要打开好几个网站开始搜索，来回切换让我抓狂的时候，我知道是时候该做点什么了。

妈妈再也不用担心我找不到我想听的歌了。

支持音乐平台

- 网易云音乐
- QQ 音乐
- 酷狗音乐
- 酷我音乐
- bilibili
- 咪咕音乐
- 千千音乐

搜歌，听歌，就用 `Listen1`。

[![imgur](https://i.imgur.com/dIVFtor.gif)]()

V2.9.0 新特性：自动切换播放源(Beta)

当一首歌的播放源不可用时，会自动搜索其他平台，获得可用的播放源。避免了用户手动搜索的麻烦。

还有精选歌单哦。

## 官方商店安装（推荐）

按你的浏览器类型点击下面的链接安装

- [Chrome Web Store 安装](https://chrome.google.com/webstore/detail/listen-1/indecfegkejajpaipjipfkkbedgaodbp)
- [FireFox 安装](https://addons.mozilla.org/zh-CN/firefox/addon/listen1/)
- [Microsoft Edge 安装](https://microsoftedge.microsoft.com/addons/detail/bcneiehcbgahghfmgigmblcgkhihehad)

## Chrome 下载安装

1. 下载项目的 zip 文件，在右上方有个 `Download ZIP`, 解压到本地

2. chrome 右上角的设置按钮下找到更多工具，打开`扩展程序`

3. 选择 `加载已解压的扩展程序`(如果没有显示先选中`开发者模式`)，选中解压后的文件夹，完成！

## Firefox 打包安装

1. 将根目录下 manifest_firefox.json 替换 manifest.json

2. `cd listen1_chrome_extension`

3. `zip -r ../listen1.xpi *`, 完成打包 xpi 文件

4. 打开 Firefox，加载 xpi 文件，完成安装


## License

MIT
