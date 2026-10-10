# 网易基岩版作品内容来源

本次内容于 **2026-10-10（Asia/Shanghai，按项目维护日期）** 从官网原有的 8 个网易地图商店链接，以及工作室补充的 13 个链接核实。共 21 个链接均可通过商店自己的公开 H5 详情请求取得说明，返回 HTTP 200、`code: 0`。没有使用登录凭证，也没有读取或保存账户邮箱等无关字段。新增链接中无用的 `channel=netease.taptap_cps_dev` 参数已移除，保留 `uid` 和 `id`。

作品目录现有 26 条记录，其中网易基岩版分类为 21 条：20 张地图及 1 个音乐制作命令包。命令包按工作室要求保留在网易版分类，表示其分发入口；玩法／用途标签另外标明「音乐」「创作辅助」。新增历史作品不会自动增加到首页精选。

## 文件与用途

- `public/content/netease/<i18nKey>.md`：原有 8 张地图的中文概述；新增 13 条使用 `<slug>.md` 命名，均由详情页按需加载。
- `public/content/netease/<i18nKey>.json` 或 `<slug>.json`：原始说明 HTML、来源链接、商店标题、时间、署名及公开数据快照。未核实语义的版本字段保存在 `unverifiedVersionFields` 中；新记录的 `cover` 还记录原始封面地址和本地优化结果。此文件用于内容维护和核对，不应整批放进首页 JavaScript。
- `public/content/netease/hungerGamesOldCity.changelog.md`：从旧城迷行原商店说明中单独提取的 **v2.0** 更新日志。接口原始 `mod_version` 为 `2.2`，但该字段的语义尚未核实，不能据此将日志改标为 v2.2。
- `public/works/werewolf-town-assassination/changelog.md`：从狼人小镇原商店说明提取的 **2.0** 平衡调整、场景细节与观战系统更新。原文没有明确该版本的准确发布日期。
- `public/maps/netease/<资源ID>.webp`：新增 13 条作品的独立封面，不是从用户截图拼接或生成的替代图。

概述按原文转成 Markdown，保留玩法、作者署名、限制说明、历史联系方式和原文用词。移除了 Quill 的字号、颜色和空白段落；标题和分段仅根据原说明的段落标签整理。原商店说明内嵌图片与画廊截图没有抓取或下载，也没有加入概述；内嵌图片的原始 URL 保存在各条 JSON 的 `originalEmbeddedImageUrls` 中。若后续有可公开使用的截图，可直接编辑 Markdown 补充。

新增 13 张封面来自接口的 `title_image_url`。原始 PNG 均为 1000 × 1000，总计 **11,323,265 字节**；仅进行等比缩放及 WebP 编码，部署文件为 544 × 544，总计 **535,922 字节**。没有裁切、更换文字或生成内容。该数字只比较封面文件体积，不代表整站加载速度的实测改善。原始地址、尺寸、字节数和本地文件路径保留在对应 JSON 的 `cover` 中。

历史联系方式只代表商店原文，尤其竞技场说明的旧 QQ 群、海岛逃生说明的 `9377060015` 均未另行核实，不能替代网站当前统一联系方式。飞行棋说明中「电影游戏社」「并非工作室」等组织介绍也是当年的原文，不代表 Fimel 当前定位。旧招募和好评请求不是当前维护状态的证据。

## 核实结果

表中日期由接口的 Unix 秒时间戳转换为 **Asia/Shanghai（UTC+08:00）**。各 JSON 同时保存原秒值和 UTC ISO 时间，避免因运行环境时区而变化。

### 原有 8 条

| i18nKey | 商店标题 | 原始 mod_version（语义未核实） | 商店创建日期 | 商店更新时间 | 原始商店链接 |
| --- | --- | --- | --- | --- | --- |
| werewolfFTown | 狼人杀-F小镇 | 1.23 | 2021-07-12 | 2021-07-12 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4648588173337957318) |
| hungerGamesOldCity | 饥饿游戏：旧城迷行 | 2.2 | 2022-08-09 | 2022-08-28 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4657291854883079467) |
| abyssSkyPit | ABYSS天坑 | 1.23 | 2021-09-03 | 2021-09-03 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4649770038789663060) |
| fmlSkyNatureArena | FML空生自然竞技场职业大乱斗 | 1.21 | 2021-04-02 | 2021-07-14 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4646359448597896554) |
| runForMoney | 逃走中 | 2.0 | 2022-01-28 | 2022-01-30 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4653059746050819814) |
| powerOn2SnowCrisis | 通电2雪域危机 | 2.1 | 2022-06-02 | 2022-06-02 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4655644384723477429) |
| islandEscapeBeforeDawn | 海岛逃生--黎明前夕 | 3.2 | 2025-02-16 | 2025-02-16 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4677793220493990518) |
| amethystSalvation | 【闯关rpg】紫晶幻域 | 2.11 | 2024-07-01 | 2024-09-20 | [商店](https://resource-minecraft.h5.163.com/#/detail?id=4672593901126936215) |

### 新增 13 条

| slug | 商店标题 | 原始 mod_version（语义未核实） | 商店创建日期 | 商店更新时间 | 原始商店链接 |
| --- | --- | --- | --- | --- | --- |
| music-command-pack | 我的世界音乐制作命令包 | 1.22 | 2021-04-17 | 2021-07-10 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4646512948266854981) |
| es-atrium-showdown | ［ES］中庭决战-职业对抗 | 1.23 | 2021-08-30 | 2021-08-30 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4649725567306540590) |
| ej-qingbo-survival | ［Ej］生存家园-青泊庄 | 1.23 | 2021-08-27 | 2021-08-27 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4649651119622229329) |
| hit-the-plane | Hit the plane | 1.21 | 2021-04-30 | 2021-08-13 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4646050867772266368) |
| chinese-chess-cb | 中国象棋[CB] | 1.22 | 2021-06-05 | 2021-07-19 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4647154283526030957) |
| aeroplane-chess-cb | 飞行棋[CB] | 1.23 | 2021-07-29 | 2021-07-29 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4648967044809257014) |
| power-duel | 通电对决 | 1.23 | 2021-08-07 | 2021-08-13 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4649240382612267969) |
| battle-for-kade | 决战，卡得！ | 1.23 | 2021-08-07 | 2021-08-13 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4648994215119378218) |
| werewolf-modern-city | 狼人杀现代城市 | 1.23 | 2021-08-07 | 2021-08-13 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4648967718332648481) |
| shadow-assassin | 暗影刺客[小游戏] | 1.23 | 2021-08-07 | 2021-08-07 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4648788016015567149) |
| mountain-town | 山野小镇 | 1.23 | 2021-08-08 | 2021-08-08 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4648775938384483560) |
| murder-mystery-planet | 密室杀手星球版 | 1.23 | 2021-08-10 | 2021-08-20 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4649193987275973018) |
| werewolf-town-assassination | 狼人小镇刺杀行动2.0 | 1.23 | 2021-08-13 | 2022-01-25 | [商店](https://resource-minecraft.h5.163.com/#/detail?uid=2772171834&id=4649390432729817156) |

商店的 `developer_name` 在 21 条记录中均为 **KCINE**。这是商店发布账户，不等于所有作品都由此人独立创作；ABYSS 原文还明确注明由 `CINE_GAME(KCINE)` 代发。各 JSON 的 `creditedAuthors` 只收录原文中明确出现的创作者署名，不根据发布账户推测作者。原说明中没有明确个人署名的逃走中、音乐制作命令包、狼人小镇刺杀行动保留空数组；后两条目录使用工作室提供的 Fimel Studio 组织归属，不冒充已核实的个人署名。

Hit the plane、中国象棋和飞行棋的原文明确写「作者：KCINE」，因此这三条可以据此署名。青泊庄区分作者建造老e与「体验及帮助：水晶215」，不能把帮助者直接改成独立作者。山野小镇原文写「建筑老e」，保留原字，不自动推定别名对应关系。通电对决原文明确说明地图与玩法由建造老e、水晶215原创；其他作品不因发布账户相同而自动添加原创或授权声明。

`snapshotStats` 是这次核实的下载量、评分、评论数等快照，不能描述为实时数据。接口的 `mod_version`、`res_version` 与实际作品版本不能直接画等号；其确切语义尚未核实，统一作为 `unverifiedVersionFields` 保留，不用于目录的作品 `version`。之前将 `mod_version` 直接写为作品版本、并断言其不是客户端版本的说明缺少依据，现已撤回。正文明确写出的音乐制作命令包 `0.0.4`、狼人小镇 `2.0` 才作为作品版本依据。

`publishedAt` 和 `updatedAt` 分别来自 `create_time` 与 `refresh_time`，表示商店创建、更新时间，不代表每一次版本发布的时间。音乐命令包正文的 `2021-06-06` 是其明确标注的 0.0.4 更新日期，与商店最后更新时间 `2021-07-10` 不同；狼人小镇 2.0 的发布日期不能从 `refresh_time` 推算。

中国象棋原说明明确提示：游戏更新删除了所需实体，导致地图无法游玩。目录摘要及详情保留该警告；「已发布」仅表示有历史发布记录，不承诺当前可用或正在维护。接口的 `pvp` 字段在命令包和生存家园等条目中也为 `true`，因此不据此自动生成标签；分类依据作品正文中的实际玩法。

## 获取方式与边界

商店入口是 hash 路由；直接抓取入口 HTML 只会得到 H5 应用外壳，说明由应用后续请求加载。通过公开页面脚本可确认详情接口为：

```text
POST https://g79apigatewayobt.nie.netease.com/h5/pe-item-detail-v2
```

请求的公开参数为 `item_id` 和 `channel_id: 5`，原商店 H5 使用其公开的请求签名逻辑；原始说明对应 `entity.info`。没有在页面运行时增加对网易接口的依赖。用户浏览作品时读取随站点部署的 Markdown，点击商店按钮再进入原网易链接。

网易公开入口仍可能受平台、设备或客户端唤起限制，因此商店按钮应准确命名为“前往网易商店”，不能承诺“直接下载”。

21 条记录中，旧城迷行 v2.0 与狼人小镇 2.0 有可单独提取的真实更新日志。音乐制作命令包只提供版本及更新日期，没有具体变更清单；中国象棋的「更新小贴士」是兼容性警告，不是新版本发布日志。其余没有可核实日志的作品应展示空状态或后续由工作室补充，不能自动生成虚构记录。商店也没有公开 JAR/地图文件下载地址，不应创建虚构下载按钮。

后续新增或修订时，可以直接编辑对应 `.md` 并提交 GitHub；`.json` 保留为来源快照，站点的作品索引应引用 Markdown 路径和原商店 `sourceUrl`。
