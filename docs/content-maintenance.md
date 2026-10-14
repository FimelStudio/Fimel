# 网站内容维护说明

作品页使用静态 JSON 目录和 Markdown 正文。新增一个作品时，准备一条目录记录、封面和三个页签的正文即可，不需要复制页面组件，也不需要增加路由。

## 修改主页文案

主要编辑 `src/i18n.ts` 中 `resources.zh.translation` 的对应字段。英文和日文分别在同一文件的 `en.translation`、`ja.translation` 中，中文修改后建议同步。

| 页面内容 | 文案位置 |
| --- | --- |
| 首屏大标题 | `hero.crafting`、`hero.worlds` |
| 首屏介绍 | `hero.sub` |
| 工作室定位、首屏按钮 | `home.studio_label`、`home.featured_cta`、`home.current_cta` |
| 作品快速入口标题与介绍 | `home.quick_title`、`home.maps_*`、`home.mods_*`、`home.tools_*` |
| 滚动文字带 | `marq.pvp`、`marq.rpg`、`marq.puz`、`marq.vdl`、`marq.jve` |
| 工作室介绍与统计说明 | `about.title`、`about.desc`、`about.y1*`、`about.y2*` |
| 首页精选作品总标题 | `works.title` |
| 精选分组标题与按钮 | `src/content/messages.ts` 的 `homeFeatured.*` |
| 精选作品名称、短简介、封面、状态和标签 | `public/works/catalogue.json`（有 `translations` 时读取其指向的 i18n 字段） |
| 网易地图名称与短简介 | `works.bedrockMaps.<作品键>` |
| 首页 Bingo 简介 | `home.mods_desc` |
| 首页方块转换器简介 | `home.tools_desc` |

布局与文案的调用位置在 `src/pages/Home.tsx`。搜索页面中出现的 `t('字段名')` 或 `i18nKey="字段名"`，即可找到对应翻译。通过 `Trans` 渲染的标题与介绍可以使用现有的 `<br/>` 换行；普通 `t()` 字段不要加入 HTML。

`about.*` 同时用于「关于我们」页面，修改会影响两处。首页少量装饰性英文仍在 `Home.tsx` 中。作品目录中的 Bingo 简介仍在 `siteMeta.bingoDescription`，转换器简介在 `workPages.tools.objCubizer.desc`；目录标签不再使用旧的 `siteMeta.bingoTags` 或功能清单，见下方玩法分类说明。

### 更换首页精选作品

只需修改 `src/content/home-featured.ts` 的 slug 列表与顺序，不再通过 `bedrockEntries[6]` 等数组下标挑选。`maps` 是已发布网易地图，`released` 是已发布的模组与创作工具，`development` 是尚未发布的作品；状态不符合分组的项目不会展示。正式发布 Fimel Card 等项目后，应把它从 `development` 移到合适的已发布分组。

卡片布局在 `src/components/HomeFeaturedWorks.tsx`。显示信息与作品页共用 `useProjectCatalogue` 缓存及 `projectCopy`，不在 Home 再维护一份标题、封面或商店数据。图片懒加载，目录等待或失败不阻塞首屏；失败时提供重试及完整作品页入口。当前精选地图为海岛逃生、紫晶幻域和中庭决战，覆盖非对称竞技、PvE/RPG 与职业 PvP；Minecraft Explorer、OBJ Cubizer 和 Bingo 展示已发布软件，Fimel Card 与两个 Java 地图展示制作进度。

## 明亮与暗色主题

配色集中在 `src/index.css` 的 `@theme` 和 `.dark` 中。`canvas` 是页面底色，`surface` 是内容面板，`surface-raised` 是按钮／标签等次级表面，`content`／`content-muted` 是文字，`line` 是边框。明亮模式保留原有纸白背景；暗色采用 GitHub 风格的蓝灰背景和表面层级，保留 Fimel 的青色与紫晶色。

顶部主题按钮会记住选择；首次访问跟随系统主题。`index.html` 在应用加载前恢复主题，避免暗色刷新时闪出白底。新增组件优先使用这些语义颜色，不要再写一个新的纯黑面板。

## 导航 Logo 与字标

导航品牌组合在 `src/Layout.tsx`：左侧使用 `public/assets/brand/fimel-logo.svg`，右侧固定文字 `Fimel Studio`。SVG 是现有 PNG 的轮廓描摹版，不是新设计；原 PNG 保留为图片失败时的备用资源及 favicon／分享预览。

尺寸、间距及像素字标排版在 `src/index.css` 的 `.brand-*` 中。图标手机显示 44px，平板 52px，桌面 56px；字体仅用于字标，本地加载 Minecraft Seven 的 ASCII 子集，来源与 OFL 许可证位于 `public/assets/fonts/minecraft-seven/`。它接近 Animated Java 导航的 Minecraft 像素字形，不直接分发参考站中注明保留所有权利的 `MinecraftFull.ttf`。旧 Monocraft 文件保留，但不再加载。

字标配色在 `--brand-gradient` 和 `--brand-hover-gradient`，明暗主题分别定义。悬停与键盘焦点都使用第二组渐变，180ms 透明度交叉淡入，不使用持续运行的动画或 JS 鼠标监听。减少动态效果模式立即换色；强制对比度模式回退到系统链接颜色。

后续更换品牌图形时，优先提供设计工具导出的 SVG，并同步保留备用 PNG。不要通过上采样 PNG 宣称增加了真实细节；不要把字标字体替换为未加载的 `Minecraftia` 字族名。检查 320px 手机、768px 平板、明暗主题和三语言导航均能显示。

## 团队头像

四位成员的 Minecraft 头像保存在 `public/assets/images/team/`，在「关于我们」的团队列表中使用。`YYYlong.png` 对应 Ylong，`TreeHey.png` 对应 TreeHey，`crystal215.png` 对应 crystal215，`chengzi_bucheng.png` 对应 chengzi。

如需更换头像，可以替换对应 PNG，或修改 `src/pages/Studio.tsx` 的 `team` 数组中的 `avatar`。路径必须保留 `basePath` 前缀，兼容 Cloudflare 根域名和 GitHub Pages 子目录；不要在页面中引用本机桌面路径。显示保留像素边缘并预留正方形尺寸，加载失败会回退到成员字母。

## 新增作品

较大的 ZIP 发行文件可使用本机 `scripts/upload-r2.ps1` 上传到 R2，确认流程、安全限制与下载地址接入见 [R2 上传说明](r2-uploads.md)。上传脚本不会自动修改本目录、提交或部署网站；正式文件必须先获确认，凭据不得放入目录 JSON 或前端环境变量。

1. 在 `public/works/catalogue.json` 的 `projects` 数组中增加记录，保持 `schemaVersion: 1`。不要修改现有作品的 `slug`，它是分享链接的一部分。
2. 把作品自己的封面放到 `public/assets/images/works/<slug>/cover.<扩展名>`，不要散放在 `public/` 根目录，也不要用其他作品的图片代替。
3. 在 `public/works/<slug>/` 创建 `description.zh.md`、`changelog.zh.md`、`versions.zh.md`，并在 `content` 中填写路径。有英文和日文正文时再增加对应的 `.en.md`、`.ja.md`。
4. 运行 `npm run build`，根据目录和资源校验报错修正内容，然后在预览中检查三个页签。
5. 提交到 GitHub，由已有的部署流程更新网站。

`npm run check:content` 会依次运行 `scripts/validate-content.mjs` 和 `scripts/validate-assets.mjs`，生产构建也会自动运行这两项检查。除目录字段与玩法标签外，还会核对运行时作品类型和 JSON Schema 的枚举是否一致、资源与正文文件名的实际大小写、源码静态资源引用、Markdown 相对媒体链接及来源快照中的本地路径。Windows 本机接受的大小写错误可能在 Cloudflare 或 GitHub Pages 变成 404；不要绕过校验只凭本机预览判断。

以下是完整、合法的目录格式示例。实际追加时只把 `projects` 内的一条记录放入现有数组，并创建示例引用的三个正文文件。封面使用当前已有的材质文件，仅用于说明格式，正式作品应换成自己的封面。

```json
{
  "schemaVersion": 1,
  "projects": [
    {
      "slug": "my-new-map",
      "type": "java",
      "title": {
        "zh": "我的新地图",
        "en": "My New Map",
        "ja": "新しいマップ"
      },
      "summary": {
        "zh": "一句话介绍玩法和玩家要完成的目标。",
        "en": "A short introduction to the gameplay.",
        "ja": "ゲームプレイの短い紹介。"
      },
      "tags": ["puzzle", "co-op"],
      "image": "assets/textures/minecraft/diamond_block.png",
      "imageFit": "cover",
      "status": "development",
      "platform": ["Minecraft Java"],
      "creators": [
        {
          "name": "Fimel Studio",
          "url": "https://github.com/FimelStudio"
        }
      ],
      "content": {
        "description": {
          "zh": "works/my-new-map/description.zh.md"
        },
        "changelog": {
          "zh": "works/my-new-map/changelog.zh.md"
        },
        "versions": {
          "zh": "works/my-new-map/versions.zh.md"
        }
      }
    }
  ]
}
```

`type` 只使用以下五种值。Java 地图和数据包已分为独立分类，不能再把所有 Java Edition 内容统一填为 `java`：

| 值 | 显示分类 |
| --- | --- |
| `bedrock` | 网易基岩版地图 |
| `java` | Java 版地图 |
| `datapacks` | 数据包 |
| `tools` | 插件与工具 |
| `mods` | 模组 |

`status` 使用 `released`（已发布）、`development`（制作中）、`planned`（企划）。`slug` 使用小写英文字母、数字和短横线，必须唯一。

可选字段包括 `published`、`updated`、`version`、`size`、`repository`、`issues`、`store`、`download` 等。只有已经核实的发布日期或更新时间才填写 `YYYY-MM-DD`。未发布作品的版本号和日期直接省略，不要填写今天的日期或虚构版本。版本 Markdown 可以明确写「尚未发布，暂无可下载版本」。

新增条目会自动进入作品目录和详情页，但不会自动成为首页精选。首页保留人工精选，避免新增历史项目后主页继续增长。

### Fimel Card 与数据包分类

`Fimel Card 卡牌桌游数据包` 属于 `datapacks`，当前状态为 `development`（制作中／暂未发布）。仓库入口由工作室提供：[FimelStudio/fimelcard-dp](https://github.com/FimelStudio/fimelcard-dp)。目前公开访问无法取得仓库内容，目录只使用工作室已确认的名称、类型、仓库链接和未发布状态；不要据此推测玩法规则、支持版本、作者个人署名、发布日期或下载地址。

封面已使用工作室提供的图片。后续公开规则和版本后，更新该作品自己的 JSON 记录及 Markdown；有真实发行文件时才加入下载入口。现有网易音乐制作命令包仍按分发平台保留在 `bedrock`，不会因新增「数据包」分类自动迁移。

## 多语言与旧翻译键

`title`、`summary` 可以是一个字符串，也可以是包含 `zh`、`en`、`ja` 的对象。新增作品优先直接在 JSON 中填写这些内容。

`tags` 是明确填写的玩法／用途分类 ID 数组，最多 4 个，不再复用简介或功能清单。名称及中英日翻译统一维护在 `src/content/project-tags.json`，例如 `pvp`、`pve`、`asymmetric`、`rpg`、`adventure`、`puzzle`、`parkour`、`escape`、`co-op`；工具使用 `modeling`、`conversion`、`development`、`creator-tools` 等用途类别。音乐制作内容可使用 `music`（音乐），象棋、飞行棋及卡牌桌游使用 `board-game`（桌游），并结合 `strategy` 等真实玩法标签。列表、详情和搜索共用这一套分类，搜索也支持其他语言的分类名称。

玩法分类参考 [Atland](https://atland.icu/browse) 和 [MinecraftMaps](https://www.minecraftmaps.com/)，项目是否使用某类则根据其真实说明判断。不要因为 RPG 地图有一小段跑酷就把跑酷当主要标签，不要因为模组双方有不同词条就归为非对称竞技。资料不够时用空数组 `[]`，例如当前《通电2》，不编造类型。新增通用类别时，只需在标签词典中增加 ID 和三种语言名称，构建校验会检查引用是否正确。

现有条目有 `translations` 字段，用于继续复用 `src/i18n.ts` 的翻译，例如：

```json
{
  "translations": {
    "title": "works.bedrockMaps.werewolfFTown.title",
    "summary": "works.bedrockMaps.werewolfFTown.desc"
  }
}
```

配置了对应 `translations` 键时，该键的翻译优先于 JSON 的直接文字。如果修改 JSON 名称后界面没有变化，请检查这里；可以继续修改原翻译，也可以删除对应键并改用 JSON 的多语言对象。

三个正文页签同样支持语言路径。例如：

```json
{
  "description": {
    "zh": "works/my-new-map/description.zh.md",
    "en": "works/my-new-map/description.en.md",
    "ja": "works/my-new-map/description.ja.md"
  }
}
```

只提供中文也可运行，其他语言会显示现有中文正文并提示翻译尚未提供。不要把中文路径复制成 `en` 或 `ja` 来假装已经翻译。

## 编写 Markdown

概述适合放玩法、规则、兼容版本、游玩说明、截图和原始项目入口；更新日志按真实版本记录改动；版本页放兼容信息、文件名、下载入口和维护状态。没有可核实的内容时保持简短说明即可。

支持标题、段落、列表、引用、代码块、链接和表格。原始 HTML 不会渲染，不要依赖 HTML 排版、脚本或嵌入式管理界面。

Markdown 中的相对图片与链接以该 Markdown 文件所在目录解析。例如，正文是 `public/works/my-new-map/description.zh.md`，图片在 `public/assets/images/works/my-new-map/cover.png`，可写：

```markdown
## 核心玩法

这里填写真实玩法说明。

![地图封面](../../assets/images/works/my-new-map/cover.png)

[浏览其他 Java 作品](#/works?type=java)

[浏览数据包](#/works?type=datapacks)
```

JSON 中的 `image`、`download` 和 Markdown 路径都相对于 `public/`，不要写 `public/` 前缀，也不要硬编码 `/Fimel/`。前端通过 Vite 的 `BASE_URL` 拼接站点部署目录。完整的 `https://...` 外部链接也可以使用。Markdown 中优先用相对文件路径，避免以 `/assets/` 这类域名根路径引用图片，从而兼容 GitHub Pages 仓库子目录。目录与例外路径规则见 [项目目录规范](./project-structure.md)。

作品目录和正文会按需请求，正文切换后在当前浏览会话中缓存。修改后重新部署并刷新页面查看，不需要把所有 Markdown 导入首页 JavaScript。

### 添加作品图片轮播

把展示图片放在对应作品的 `public/assets/images/works/<slug>/` 中，依次命名为 `gallery-01.webp`、`gallery-02.webp` 等。然后在该作品概述 Markdown 中连续写图片行，图片之间**不留空行**：

```markdown
## 作品展示

![作品名称 · 商店展示图 1](../../assets/images/works/my-new-map/gallery-01.webp)
![作品名称 · 商店展示图 2](../../assets/images/works/my-new-map/gallery-02.webp)
![作品名称 · 商店展示图 3](../../assets/images/works/my-new-map/gallery-03.webp)
```

这仍是标准 Markdown，不需要在目录 JSON 中增加轮播组件配置。一个只包含图片的段落会被详情页渲染为画廊；连续多张图片合成一组，图片之间留空行则分成独立的单张展示。混入正文文字或把图片嵌在链接里的段落仍按普通 Markdown 渲染，不自动组成画廊。

单张图片不显示切换箭头。多张图片支持上一张／下一张按钮、手机原生左右滑动，以及聚焦画廊后的左右方向键、Home 和 End；不会自动播放，也不会循环跳回第一张。图片的替代文字同时作为当前图说明，应写清内容及真实来源，不能把宣传海报或不确定归属的图片标成玩法实景截图。

画廊接近视区时才加载当前图片与相邻图片，不会因为增加媒体就让首页或作品索引下载全部截图。图片加载失败显示局部提示，不替换为其他作品图片；`prefers-reduced-motion` 下手动切换不使用平滑滚动。仍应控制图片体积，并运行 `npm run check:content` 检查 Markdown 的相对路径。

## 网易基岩版作品来源

作品目录现有 28 条，其中网易基岩版分类有 21 条：原有 8 张地图，以及补充的 12 张地图和 1 个音乐制作命令包。命令包按工作室要求放在网易版分类，以分发入口归类，标签使用 `music`、`creator-tools`；不要因为它是命令包就自动迁移到「插件与工具」或「数据包」。

21 条作品均通过提供的原商店链接核实说明。概述统一在 `public/works/<slug>/description.zh.md`，详情页按需读取。对应来源快照统一在仓库的 `content-sources/netease/<slug>.json`，保存原始说明、来源、署名和核实数据，供维护人员查证；它们不再放在 `public/`，不会随静态资源公开部署，也不会在浏览页面时请求网易接口。

`catalogue.json` 的 `store` 是「前往网易商店」按钮入口，`source` 记录说明来源。商店入口可能受网易平台或客户端限制，不能把它写成直接下载地址。新链接保留 `uid`、`id`，删除无用的 `channel=netease.taptap_cps_dev` 参数；不要删除真正的资源 ID。

新增 13 张封面保存在各自的 `public/assets/images/works/<slug>/cover.webp`，来自公开详情的原始封面，经过等比缩放和 WebP 编码，无裁切或生成内容。每张 544 × 544，总计 535,922 字节；来源和转换信息保存于来源快照的 `cover`。不要用一个作品的封面代替其他作品。

2026-10-11 又从商店公开详情的 `entity.pic_url_list` 补入 21 条网易作品的展示图片，每条 3 张，共 63 张；下载失败为 0。文件位于各作品的 `gallery-01.webp` 至 `gallery-03.webp`，加入对应概述的「作品展示」画廊；全部派生图片合计 4,591,106 字节。只做等比缩放至最长边不超过 1280 像素及 WebP 编码，不裁切、不生成或修改图片内容，也不用封面重复填充截图。

原商店正文内嵌的图片没有自动导入：这些图片可能是跨作品共用的宣传图，不能因为出现在说明里就认定为该地图实景。`originalEmbeddedImageUrls` 继续保留为来源记录，截图来源单独记录在来源 JSON 的 `gallery` 中，包含来源字段、地址、本地路径、原始及派生尺寸／体积和原文件 SHA-256。浏览网站只加载本地展示图，不请求网易接口。

原商店说明中的旧 QQ、旧联系方式和作者署名属于历史内容。不要将这些历史联系方式自动覆盖到工作室当前统一联系方式。当前站点联系方式维护在 `src/pages/Studio.tsx`，联系分类文案在 `src/content/messages.ts` 的 `studioContact` 中，由 `src/i18n.ts` 引入。

详细来源、日期、作者署名与公开数据的边界见 [网易内容来源说明](./netease-content-sources.md)。接口的 `mod_version` 和 `res_version` 暂存为 `unverifiedVersionFields`，其语义尚未核实；不要据此填写目录里的作品 `version`，也不要当作 Minecraft 兼容版本。音乐制作命令包正文明确标注 `0.0.4`、更新日期 `2021-06-06`，狼人小镇正文明确标注 `2.0`，这些有正文依据的版本可以填写。

旧城迷行原说明中的日志是 v2.0，不能因接口 `mod_version` 为 `2.2` 就将日志改标为 v2.2。狼人小镇 2.0 的真实日志保存在 `public/works/werewolf-town-assassination/changelog.md`，但其准确发布日期未公开。其他没有公开日志的作品不要生成虚构记录；商店 `create_time`、`refresh_time` 也不构成完整版本发布历史。目录里的下载量和评分属于历史快照，更新时同时保留来源和核实时间。

中国象棋原文提示游戏更新后所需实体被删除、无法游玩，目录及详情中的兼容性警告不能在润色时删除。「已发布」表示历史发布状态，不代表仍在维护或当前可用。`developer_name` 是发布账户，只有原文明确署名时才可当作作者；没有个人署名的作品保留来源记录中的空署名数组，不猜测个人作者。历史组织介绍、旧招募内容也不能替换 Fimel 当前品牌介绍。

## 下载与部署路径

网站发行文件统一通过 R2 下载，发布后的 canonical 地址维护在 `public/works/catalogue.json` 的 `downloadUrl`。它优先于旧本地 `download`、`fallbackDownload` 或 GitHub `latestReleaseRepo`；未迁移且没有 `downloadUrl` 的旧记录仍兼容原下载逻辑。只给已发布作品填写 R2 地址，不给制作中的项目伪造下载。

当前已迁移 OBJ Cubizer 1.4.0 ZIP、Minecraft Explorer 1.0.2 EXE 与 Bingo 发行标签 1.0 JAR。文件不重新打包，公开域名为 `https://download.studiofimel.com`，路径为 `works/{type}/{slug}/{version}/{filename}`。上传操作、确认、校验与正式迁移哈希见 [R2 上传说明](r2-uploads.md) 和 [发行清单](r2-release-manifest.json)。不把密钥写入目录、前端 VITE_ 变量或 GitHub Pages。

Bingo 的目录版本使用 `1.21.11-v1.0`（Minecraft 兼容版本 + 发行版本），不是仅 `1.0`。后续模组上传也按这一约定填写脚本 `-Version`，网站 `version` 的展示标签可保持简短的发行版本。

后续先用 `scripts/upload-r2.ps1` 预检查，再在获确认后上传；校验远端与公开下载成功，才更新 `downloadUrl`、版本及三个语言的版本正文。使用新版本路径，拒绝覆盖同名对象。新文件放在仓库外，网站只引用 R2 地址，不再把发行包放入 `public/`。

Explorer 的当前记录为 `minecraft-explorer`、`tools`、1.0.2，文件名保留 `MinecraftExplorer-1.0-win-x64.exe`。不设置 `latestReleaseRepo`，不经过仅选择 JAR 的旧 Bingo 逻辑。更新时使用普通 Release 构建，核对实际版本、文件名、体积及 SHA-256，页面继续说明运行库、缓存位置及内置许可。展示截图仍归 `public/assets/images/works/minecraft-explorer/`。

Bingo 的 GitHub repository / releasePage 保留作为源码与发布记录。当前 `downloadUrl` 指向 R2 的已校验发行文件，按钮不再每次查找 GitHub 最新版；新版发布必须上传新路径并更新目录。

原 `public/mods/` JAR 和 `public/plugins/` ZIP/EXE 暂时保留，不删除用户原件；旧路径字段用于兼容，不是当前主要下载地址。构建通过 `prepare-bingo-download.mjs` 兼容入口调用 `prepare-r2-downloads.mjs`，生成旧路径映射及 Wrangler 忽略清单，不再生成 Bingo 分片。Cloudflare Worker 对这三个旧路径跳转 R2；GitHub Pages 保留静态旧原件，页面的新下载统一使用 R2。已有插件源码、Blockbench 元数据入口及下载统计不变。

OBJ 转换器的网站中文概述位于 `public/works/minecraft-obj-cubizer/description.zh.md`，从插件包的原 `about.md` 原样复制而来。网站读取这份正文；原插件包里的 `about.md` 保留，不移动或删除。后续修改网站文案编辑作品正文，修改插件自身发行说明仍遵循插件包的发布流程；需要两者内容一致时明确同步，不依赖隐式引用。

站点仍使用 HashRouter。独立域名根目录的路径是 `/#/works`，详情页例如 `/#/works/bingo-but-dont-do-it?tab=versions`。分享这个完整链接可以直接进入对应页签；刷新时只请求站点根页面，因此兼容 GitHub Pages 的静态路由。

Cloudflare 独立域名默认使用 Vite `base: '/'`，不需要设置 `VITE_BASE_PATH`。GitHub Pages 工作流会读取 `configure-pages` 的 `base_path`，为该次构建自动设置 `VITE_BASE_PATH`（例如 `/Fimel/`），访问路径变为 `/Fimel/#/works`。本地测试子目录部署时也可以设置这个环境变量。作品内容中的资源路径无需随着域名改变。

本次内容维护方式不包含发布操作。构建与部署仍由既有 GitHub 或 Cloudflare 流程执行，维护人员应先检查本地预览再提交。

## 是否需要开发者管理模式

当前 JSON 和 Markdown 都可以在本地编辑，也可以使用 GitHub 网页编辑文件、预览 Markdown、提交修改。它适合目前的项目数量，文件历史可追溯，Cloudflare 与 GitHub Pages 共用同一份内容，不需要维护另一套后台。

纯 GitHub Pages 页面不能直接把浏览器中的修改写回仓库。一个只有隐藏按钮或前端密码的「管理员模式」也不能提供可靠的写入权限。

如果未来需要真正的后台，可增加 Cloudflare Worker 管理接口、账户身份验证和服务端权限检查，再由服务端使用受限的 GitHub 凭证提交 JSON 与 Markdown，或改用独立内容存储。GitHub Pages 仍可作为公开前端，但后台请求必须发往有服务端能力的接口。

GitHub 写入凭证只能放在服务端密钥中，不能放进 JSON、网页代码或 `VITE_` 环境变量。后台还需要处理编辑冲突、图片上传、内容预览和发布流程。当前实现先使用仓库编辑方式，已经支持逐个增加项目及三个正文页签；以后增加后台时，可以继续复用现有目录字段和详情页模板。
