# 导航字标字体

`monocraft-latin.woff` 来自 [IdreesInc/Monocraft](https://github.com/IdreesInc/Monocraft)，作者 Idrees Hassan，使用 SIL Open Font License 1.1；完整版权及授权文本保存在同目录 `OFL.txt`。

- 上游固定提交：`e498bf70aeb25b4bdcff1e44d878fb2cb4f7c2a9`。
- 原文件：`dist/Monocraft-ttf/Monocraft.ttf`。
- 处理：使用 FontTools 保留 U+0020-007E 可打印 ASCII，移除编程连字并编码为 WOFF；保留字体名称及版权元信息。
- 用途：仅导航中的 `Fimel Studio` 字标及标志加载失败时的 `F`。不替换正文、菜单或原有 HUD 字体。
- CSS 字族名：`Fimel Pixel`，在 `src/index.css` 定义，采用 `font-display: swap`；`index.html` 预加载同一站点的字体文件。

更新时须同步 CSS／预加载地址并保留许可证。不要将该字体子集用于未包含的中文或日文正文。
