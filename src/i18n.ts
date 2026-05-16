import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  zh: {
    translation: {
      nav: { about: "关于我们", works: "作品阵列", contact: "联络合作", menu: "菜单", nav_maps: "地图作品", nav_maps_be: "基岩版 / 网易版", nav_maps_je: "Java 原生版", nav_mods: "模组开发", nav_tools: "插件与工具" },
      hero: { gen: "世界生成中...", crafting: "构筑", worlds: "无限", sub: "以机制重组法则，用指令重制原版。<br/>专注于顶尖的 Minecraft 玩法构筑，为您提供远超常理的 PVP、RPG 及硬核解密地图游玩体验。", scroll: "向下滑动" },
      marq: { pvp: "PVP 竞技场", rpg: "RPG 沉浸冒险", puz: "硬核解密", vdl: "体素视觉设计", jve: "Java 原生架构" },
      about: { tag: "工作室宣言", title: "打破传统边界，<br />重塑沙盒交互。", desc: "Fimel 工作室成立于 2019 年。由于起初专注于中国版 Minecraft（网易版），我们在 PvP、PvE、RPG、逃生及建筑等众多类型上均有建树，并取得了众多现象级的下载成绩与玩家口碑。如今团队正同时进军 Java 原生端，在各大神仙服与平台不断刷新玩家的体验认知。", y1: "2019", y1_sub: "创立年份", y2: "10+", y2_sub: "总发行佳作", render: "核心方块载入完毕" },
      process: { title: "构筑维度", p1: "视觉设计", p1_sub: "从零开始的美学构筑", p2: "原生地形", p2_sub: "亿万级方块尺度演算", p3: "机制编程", p3_sub: "底层引擎逻辑重构", p4: "交互叙事", p4_sub: "多维沉浸感知设计" },
      core: { tag: "核心领域", pvp: "PvP & PvE 战斗", pvp_d: "涵盖极快判定的技能对抗与职业平衡设计，以及硬核的 PvE 生存玩法与地貌探索。", rpg: "RPG & 剧情逃生", rpg_d: "打造庞大的箱庭世界观、定制模型细节，并融合沉浸式剧情叙事与极具挑战的密室逃脱。", puz: "体素建筑 & 机制", puz_d: "从零构筑震撼视觉的史诗建筑，结合原生红石与高阶数据包重构底层逻辑。" },
      team: { 
        tag: "核心团队", 
        role1: "创始人 / 策划 / 建筑", 
        role2: "主程序 / 逻辑机制", 
        role3: "视觉设计 / 美术", 
        role4: "关卡交互 / 环境构建" 
      },
      works: {
        title: "入选<br/>作品", inquire: "获取游玩授权", 
        category_maps: "地图作品 / MAPS",
        category_mods: "模组开发 / MODS",
        category_tools: "插件与工具 / TOOLS & PLUGINS",
        m1_t: "狼人杀：F小镇", m1_c: "狼人杀 PvP", m1_d: "网易版现象级角色扮演与推理生存地图。",
        m2_t: "饥饿游戏：旧城迷行", m2_c: "PvP 竞技", m2_d: "基于旧城废墟的冒险与杀戮。",
        m3_t: "ABYSS天坑", m3_c: "Hypixel系 PvP", m3_d: "跌落深渊，在黑暗与绝望中寻找生机。",
        m4_t: "FML空生自然竞技场", m4_c: "原创职业 PvP", m4_d: "悬浮于虚空之上的竞技擂台，用纯粹的战斗与走位决出真正的胜者。",
        m5_t: "逃走中", m5_c: "对战地图", m5_d: "参考日本节目《全员逃走中》的作品。紧张刺激的隐蔽与追脱玩法，在庞大迷宫中完成任务并躲避猎人追捕。",
        m6_t: "通电2：雪域危机", m6_c: "非对称对战游戏风", m6_d: "深入破败的极地科考站，重启发电机，面对未知的寒冬与硬核逻辑谜题。",
        m7_t: "海岛逃生：黎明前夕", m7_c: "感染/塔防 PvP", m7_d: "具有复杂的建筑结构的遗世孤岛，在绝境中发掘不为人知的惊天秘密。",
        m8_t: "紫晶幻域：救世光源", m8_c: "剧情驱动 RPG", m8_d: "结合宏大沉浸叙事与定制化模型构建史诗级世界观的独立大型作品。",
        m9_t: "海岛逃生：黎明前夕 (Java版)", m9_c: "感染/塔防 PvP", m9_d: "经典孤岛生存玩法的 Java 核心重构版，包含全新机制设计。",
        m10_t: "剧透太多的RPG", m10_c: "沉浸式 RPG", m10_d: "致敬/授权自 KSB 工作室的同名作品改编，宏大的 Java 版叙事 RPG 企划。",
        mod1_t: "未定模组项目", mod1_c: "系统扩充", mod1_d: "更多硬核引擎拓展与独立模组正在研发中，敬请期待。",
        tool1_t: "开发工具链", tool1_c: "工作流集", tool1_d: "基于数据包与插件架构定制的可视化开发辅助与优化脚本框架。",
        view: "查看详情",
        open_detail_aria: "查看 {{title}} 的网易资源中心详情",
        downloads_metric: "{{downloads}} 下载",
        rating_metric: "{{rating}} 评分",
        comments_metric: "{{comments}} 评论 / {{remarks}} 评价",
        released_metric: "发布时间 {{date}}",
        bedrockMaps: {
          werewolfFTown: {
            title: "狼人杀-F小镇",
            subtitle: "Werewolf: F-Town",
            category: "网易基岩版地图",
            genre: "狼人杀 PvP / 推理生存",
            desc: "开局随机分配侦探、狼人和平民。狼人需要清除侦探与平民，侦探持弓找出狼人，平民可收集资源购买箭矢反击。",
            players: "多人推理",
            components: ["随机身份", "侦探弓箭", "金币购买", "狼人阵营"]
          },
          hungerGamesOldCity: {
            title: "饥饿游戏：旧城迷行",
            subtitle: "Hunger Games: Old City",
            category: "网易基岩版地图",
            genre: "生存竞技 / PvP",
            desc: "旧城废墟中的自由混战。玩家选择天赋后分散出生，通过 TNT 获取物资，并利用铁砧、工作台、特殊区域与道具争夺最终胜利。",
            players: "多人乱斗",
            components: ["12 种天赋", "TNT 物资", "特殊地区", "死斗玩法"]
          },
          abyssSkyPit: {
            title: "ABYSS天坑",
            subtitle: "Abyss Sky Pit",
            category: "网易基岩版地图",
            genre: "乱斗 PvP / 1v1",
            desc: "以多人乱斗 PvP 为主，也提供纯净 1v1 对战。强化弓箭、雪球破坏、击杀连播与方块皮肤系统让战局持续变化。",
            players: "多人 / 1v1",
            components: ["强化远程武器", "技能系统", "连杀播报", "方块皮肤"]
          },
          fmlSkyNatureArena: {
            title: "FML空生自然竞技场职业大乱斗",
            subtitle: "FML Sky Nature Arena",
            category: "网易基岩版地图",
            genre: "职业大乱斗 PvP",
            desc: "空生堂职业 PvP 大乱斗内置 24 种职业，并提供死亡榜、凋零风暴、爆炸箭、闪瞎眼等多种可切换游戏设置。",
            players: "多人职业战",
            components: ["24 种职业", "死亡榜", "模式设置区", "特殊规则"]
          },
          runForMoney: {
            title: "逃走中",
            subtitle: "Run For Money",
            category: "网易基岩版地图",
            genre: "追逐竞技 / PvP",
            desc: "随机玩家会成为被猎杀目标，其余玩家化身猎人展开追捕。目标需要开箱寻找道具、撑过追杀轮次，并在最终 PvP 中活到最后。",
            players: "多人竞技",
            components: ["随机目标", "猎人追捕", "道具开箱", "最终 PvP"]
          },
          powerOn2SnowCrisis: {
            title: "通电2雪域危机",
            subtitle: "Power On 2: Snow Crisis",
            category: "网易基岩版地图",
            genre: "非对称解谜生存",
            desc: "《通电》最终章。玩家深入破败极地科考站，在严寒环境中重启发电机，并破解围绕设施展开的逻辑谜题。",
            players: "多人协作",
            components: ["发电机重启", "极地科考站", "逻辑谜题", "生存闯关"]
          },
          islandEscapeBeforeDawn: {
            title: "海岛逃生--黎明前夕",
            subtitle: "Island Escape: Before Dawn",
            category: "网易基岩版地图",
            genre: "感染逃生 / 阵营对抗",
            desc: "4-8 人逃生地图。人类阵营需要修复岛上五座信号塔并等待直升机撤离，感染者则要阻止修复并扩散感染。",
            players: "4-8 人",
            components: ["人类/感染者阵营", "五座信号塔", "职业协作", "直升机撤离"]
          },
          amethystSalvation: {
            title: "紫晶幻域：救世光源",
            subtitle: "Amethyst: Salvation",
            category: "网易基岩版地图",
            genre: "闯关 RPG / 冒险剧情",
            desc: "幻想大陆被黑暗势力笼罩，玩家选择职业后从初始村庄出发，购买道具、升级装备，并击败被紫水晶魔法召唤出的亡灵敌人。",
            players: "多人 RPG",
            components: ["职业选择", "剧情闯关", "装备升级", "亡灵敌人"]
          }
        }
      },
      workPages: {
        back_home: "返回主页",
        open_external: "打开地图链接",
        search_placeholder: "搜索地图、玩法、组件标签...",
        catalog_title: "内容索引",
        no_results: "没有找到匹配的地图",
        clear_search: "清空搜索",
        download_count_metric: "下载 {{count}} 次",
        download_count_loading: "正在读取下载次数",
        download_count_pending: "连接 Supabase 后显示下载次数",
        view_bedrock: "查看全部基岩版地图",
        view_java: "查看 Java 原生版",
        stats: { projects: "内容数量", platform: "主要平台", mode: "状态" },
        status: { live: "已发布", wip: "开发中", prototype: "原型重构", design: "企划设计", released_research: "已发布 / 预研中" },
        maps: {
          eyebrow: "作品阵列 / 地图",
          title: "地图作品",
          desc: "以主页作为入口，这里集中展示 Fimel 的地图内容：已发布的网易基岩版地图、Java 原生版企划，以及可继续展开的玩法分类。整体结构参考内容索引页，保留主页的像素、体素和高对比排版语言。",
          catalog: "精选地图目录"
        },
        bedrock: {
          eyebrow: "地图作品 / 基岩版",
          title: "网易基岩版地图",
          desc: "集中呈现已经上线网易资源中心的基岩版地图。每个条目保留封面、类型、下载量、评分、组件标签和外部链接，方便玩家直接跳转查看。 ",
          catalog: "基岩版地图库"
        },
        java: {
          eyebrow: "地图作品 / Java",
          title: "Java 原生版地图",
          desc: "这里展示正在迁移或重新设计为 Java 原生端的地图项目，重点放在服务端逻辑、数据包、插件协作和更自由的多人体验。",
          project1_tags: ["Java 重构", "感染逃生", "塔防协作", "核心机制"],
          project2_tags: ["剧情 RPG", "任务链", "定制系统", "世界观"]
        },
        mods: {
          eyebrow: "作品阵列 / 模组",
          title: "模组开发",
          desc: "面向更底层的系统拓展，包含自定义机制、服务端辅助和未来独立模组方向。当前以研发与预研内容为主。",
          tags: ["系统扩充", "机制原型", "服务端联动", "开发中"]
        },
        tools: {
          eyebrow: "作品阵列 / 工具",
          title: "插件与工具",
          desc: "沉淀 Fimel 地图制作流程里的脚本、插件、数据处理和可视化辅助工具，让复杂玩法更容易生产、调试与维护。",
          tags: ["工作流", "数据包辅助", "插件工具", "自动化"],
          objCubizer: {
            title: "Minecraft OBJ 方块转换器",
            subtitle: "Minecraft OBJ Cubizer",
            category: "Blockbench 桌面插件",
            status: "v1.0.0 稳定版",
            desc: "把 Mineways 等工具导出的 Minecraft 建筑 OBJ 转换成 Blockbench Java Block/Item 方块模型，重建轴对齐长方体，读取 MTL 与 PNG 贴图，并支持把 OBJ 贴图导出到资源包目录，方便接入 Animated Java 原版动画流程。",
            tags: ["OBJ 转方块", "MTL/PNG 贴图", "Java Block/Item", "资源包导出", "Animated Java"],
            download: "下载插件",
            repo: "查看 GitHub 仓库",
            version_label: "版本",
            author_label: "作者",
            file_label: "文件"
          }
        }
      },
      footer: { title: "准备好<br/>合作了吗？", desc: "若需了解更多详细信息或探讨合作，欢迎随时联络我们。", copy: "© 2019-2026 FIMEL 工作室 · 版权所有" }
    }
  },
  en: {
    translation: {
      nav: { about: "About", works: "Works", contact: "Contact", menu: "Menu", nav_maps: "Maps", nav_maps_be: "Bedrock / NetEase", nav_maps_je: "Java Edition", nav_mods: "Mods", nav_tools: "Tools & Plugins" },
      hero: { gen: "GENERATING WORLD...", crafting: "CRAFTING", worlds: "WORLDS", sub: "Restructuring rules through commands, reinventing vanilla through logic.<br/>Dedicated to top-tier Minecraft gameplay development, delivering mind-blowing PVP, RPG, and hardcore puzzle map experiences.", scroll: "Scroll" },
      marq: { pvp: "PvP Arenas", rpg: "RPG Adventures", puz: "Puzzle Maps", vdl: "Voxel Design", jve: "Minecraft Java Edition" },
      about: { tag: "STUDIO MANIFESTO", title: "Breaking limits,<br />Reshaping sandbox.", desc: "Fimel Studio was established in 2019. Having initially focused on the Chinese edition of Minecraft (NetEase Edition), our works span PvP, PvE, RPG, escaping, and building maps. After phenomenal success and millions of downloads there, we are now pushing the boundaries of Java Edition gameplay across various platforms.", y1: "2019", y1_sub: "Est. Year", y2: "10+", y2_sub: "Masterpieces", render: "RENDER_OBJ: CORE_BLOCK" },
      process: { title: "DIMENSIONS", p1: "VISUALS", p1_sub: "Ground-up Aesthetics", p2: "TERRAIN", p2_sub: "Billion-scale Generations", p3: "LOGIC", p3_sub: "Engine Refactoring", p4: "NARRATIVE", p4_sub: "Immersive Interactions" },
      core: { tag: "CORE EXPERTISE", pvp: "PvP & PvE Combat", pvp_d: "Covers high-speed competitive combat, class balance design, and hardcore PvE survival with landscape exploration.", rpg: "RPG & Escapes", rpg_d: "Crafting massive sandbox worlds, custom model details, immersive narratives, and highly challenging escape rooms.", puz: "Architecture & Logic", puz_d: "Building epic, visually stunning structures from scratch while refactoring engine logic via redstone and advanced datapacks." },
      team: { 
        tag: "CORE TEAM", 
        role1: "Founder / Game Designer", 
        role2: "Lead Programmer / Logic", 
        role3: "Visual & Art Director", 
        role4: "Level & Env Designer" 
      },
      works: {
        title: "Selected<br/>Works", inquire: "Inquire For Access", 
        category_maps: "Map Projects / MAPS",
        category_mods: "Mod Development / MODS",
        category_tools: "Plugins & Tools / TOOLS",
        m1_t: "WEREWOLF: F-TOWN", m1_c: "Werewolf PvP", m1_d: "A phenomenal werewolf-style survival map on NetEase Edition.",
        m2_t: "HUNGER GAMES: OLD CITY", m2_c: "Battle Royale PvP", m2_d: "Adrenaline-pumping survival game set in ruined cityscapes.",
        m3_t: "ABYSS", m3_c: "Hypixel-style PvP", m3_d: "Fall into the abyss and seek survival in darkness and despair.",
        m4_t: "FML: SKY NATURE ARENA", m4_c: "Original Class PvP", m4_d: "A combat stage suspended in the void. Rely on pure combat and swordsmanship.",
        m5_t: "RUN FOR MONEY", m5_c: "Competitive Map", m5_d: "A thrilling hide-and-seek experience based on the Japanese show.",
        m6_t: "POWER ON 2: SNOW CRISIS", m6_c: "Asymmetrical PvP", m6_d: "Delve into a ruined polar station, restart the generators to survive.",
        m7_t: "ISLAND ESCAPE: BEFORE DAWN", m7_c: "Infection/Tower PvP", m7_d: "A solitary island with complex structures. Discover hidden secrets.",
        m8_t: "AMETHYST: SALVATION", m8_c: "Story-driven RPG", m8_d: "Our first large-scale RPG project. Combines grand narratives with custom models.",
        m9_t: "ISLAND ESCAPE: BEFORE DAWN (Java Ed.)", m9_c: "Infection/Tower PvP", m9_d: "A Java Edition remake of the classic island survival game, featuring rebuilt complex systems.",
        m10_t: "TOO MANY SPOILERS RPG", m10_c: "Immersive RPG", m10_d: "An immersive narrative RPG in Java Edition, based on the original work by KSB Studio.",
        mod1_t: "Untitled Mod Project", mod1_c: "System Expansion", mod1_d: "More hardcore engine expansions & standalone mods are in development.",
        tool1_t: "Dev Toolchain", tool1_c: "Workflow Set", tool1_d: "Custom visual dev helpers and optimization scripts based on datapacks & plugins.",
        view: "View Details",
        open_detail_aria: "Open {{title}} on NetEase Resource Center",
        downloads_metric: "{{downloads}} downloads",
        rating_metric: "{{rating}} rating",
        comments_metric: "{{comments}} comments / {{remarks}} reviews",
        released_metric: "Released {{date}}",
        bedrockMaps: {
          werewolfFTown: {
            title: "Werewolf: F-Town",
            subtitle: "Werewolf: F-Town",
            category: "NetEase Bedrock Map",
            genre: "Werewolf PvP / Deduction Survival",
            desc: "Players are randomly assigned as detective, werewolf, or villager. Werewolves hunt everyone down, the detective uses a bow to identify threats, and villagers collect resources to buy arrows and fight back.",
            players: "Multiplayer deduction",
            components: ["Random roles", "Detective bow", "Coin shop", "Werewolf team"]
          },
          hungerGamesOldCity: {
            title: "Hunger Games: Old City",
            subtitle: "Hunger Games: Old City",
            category: "NetEase Bedrock Map",
            genre: "Survival Battle / PvP",
            desc: "A free-for-all survival battle in a ruined old city. Choose a talent, spawn apart, gather loot through TNT, and use crafting stations, special zones, and items to fight for the final win.",
            players: "Multiplayer brawl",
            components: ["12 talents", "TNT loot", "Special zones", "Deathmatch mode"]
          },
          abyssSkyPit: {
            title: "Abyss Sky Pit",
            subtitle: "Abyss Sky Pit",
            category: "NetEase Bedrock Map",
            genre: "Brawl PvP / 1v1",
            desc: "A PvP arena focused on multiplayer brawls with a clean 1v1 mode as well. Enhanced bows, block-breaking snowballs, kill streak broadcasts, and block skins keep each match shifting.",
            players: "Multiplayer / 1v1",
            components: ["Enhanced ranged weapons", "Skill system", "Kill streak calls", "Block skins"]
          },
          fmlSkyNatureArena: {
            title: "FML Sky Nature Arena: Class Brawl",
            subtitle: "FML Sky Nature Arena",
            category: "NetEase Bedrock Map",
            genre: "Class Brawl PvP",
            desc: "A class-based PvP brawl with 24 playable roles, plus configurable rules such as death rankings, Wither Storm mode, explosive arrows, and flash effects.",
            players: "Multiplayer class battle",
            components: ["24 classes", "Death ranking", "Mode settings", "Special rules"]
          },
          runForMoney: {
            title: "Run For Money",
            subtitle: "Run For Money",
            category: "NetEase Bedrock Map",
            genre: "Chase Arena / PvP",
            desc: "One random player becomes the target while everyone else becomes a hunter. The target opens chests for tools, survives chase rounds, and then fights to be the last standing in the final PvP.",
            players: "Multiplayer arena",
            components: ["Random target", "Hunter chase", "Item chests", "Final PvP"]
          },
          powerOn2SnowCrisis: {
            title: "Power On 2: Snow Crisis",
            subtitle: "Power On 2: Snow Crisis",
            category: "NetEase Bedrock Map",
            genre: "Asymmetric Puzzle Survival",
            desc: "The final chapter of Power On. Players enter a ruined polar research station, restart generators in the cold, and solve logic puzzles built around the facility.",
            players: "Co-op multiplayer",
            components: ["Generator restart", "Polar station", "Logic puzzles", "Survival stages"]
          },
          islandEscapeBeforeDawn: {
            title: "Island Escape: Before Dawn",
            subtitle: "Island Escape: Before Dawn",
            category: "NetEase Bedrock Map",
            genre: "Infection Escape / Team Clash",
            desc: "A 4-8 player escape map. Humans repair five signal towers and wait for helicopter extraction, while the infected team blocks repairs and spreads infection.",
            players: "4-8 players",
            components: ["Human / infected teams", "Five signal towers", "Class teamwork", "Helicopter extraction"]
          },
          amethystSalvation: {
            title: "Amethyst: Salvation",
            subtitle: "Amethyst: Salvation",
            category: "NetEase Bedrock Map",
            genre: "RPG Adventure / Story",
            desc: "A fantasy continent has fallen under darkness. Choose a class, begin from the starting village, buy items, upgrade gear, and defeat undead enemies summoned by amethyst magic.",
            players: "Multiplayer RPG",
            components: ["Class selection", "Story stages", "Gear upgrades", "Undead enemies"]
          }
        }
      },
      workPages: {
        back_home: "Back Home",
        open_external: "Open Map Link",
        search_placeholder: "Search maps, modes, components...",
        catalog_title: "Content Index",
        no_results: "No matching maps found",
        clear_search: "Clear Search",
        download_count_metric: "{{count}} tracked downloads",
        download_count_loading: "Loading download count",
        download_count_pending: "Connect Supabase to show downloads",
        view_bedrock: "View All Bedrock Maps",
        view_java: "View Java Edition",
        stats: { projects: "Content Count", platform: "Main Platform", mode: "Status" },
        status: { live: "Released", wip: "In Development", prototype: "Prototype Rebuild", design: "Design Phase", released_research: "Released / R&D" },
        maps: {
          eyebrow: "Works / Maps",
          title: "Map Projects",
          desc: "The homepage remains the entry point, while this page focuses the Fimel map catalogue: released NetEase Bedrock maps, Java Edition plans, and expandable gameplay categories. It keeps the studio's voxel, pixel, and high-contrast language while acting like a content index.",
          catalog: "Featured Map Catalogue"
        },
        bedrock: {
          eyebrow: "Maps / Bedrock",
          title: "NetEase Bedrock Maps",
          desc: "A focused catalogue of Bedrock maps published on NetEase Resource Center. Each entry keeps its cover, type, downloads, rating, component tags, and external detail link for quick browsing.",
          catalog: "Bedrock Map Library"
        },
        java: {
          eyebrow: "Maps / Java",
          title: "Java Edition Maps",
          desc: "Projects being migrated or redesigned for native Java Edition, emphasizing server logic, datapacks, plugin cooperation, and freer multiplayer experiences.",
          project1_tags: ["Java rebuild", "Infection escape", "Tower teamwork", "Core mechanics"],
          project2_tags: ["Story RPG", "Quest chain", "Custom systems", "Worldbuilding"]
        },
        mods: {
          eyebrow: "Works / Mods",
          title: "Mod Development",
          desc: "Lower-level system expansion for custom mechanics, server-side support, and future standalone mods. This page currently highlights R&D and pre-production directions.",
          tags: ["System expansion", "Mechanic prototype", "Server integration", "In development"]
        },
        tools: {
          eyebrow: "Works / Tools",
          title: "Plugins & Tools",
          desc: "Scripts, plugins, data processing, and visual helpers distilled from Fimel's map production pipeline, making complex gameplay easier to build, debug, and maintain.",
          tags: ["Workflow", "Datapack helper", "Plugin tools", "Automation"],
          objCubizer: {
            title: "Minecraft OBJ Cubizer",
            subtitle: "Minecraft OBJ Cubizer",
            category: "Blockbench Desktop Plugin",
            status: "v1.0.0 Stable",
            desc: "Converts Minecraft building OBJ exports from tools like Mineways into Blockbench Java Block/Item cube models. It rebuilds axis-aligned cuboids, reads MTL and PNG textures, and can export OBJ textures into a resource-pack folder for Animated Java vanilla animation workflows.",
            tags: ["OBJ to cubes", "MTL/PNG textures", "Java Block/Item", "Resource pack export", "Animated Java"],
            download: "Download Plugin",
            repo: "View GitHub Repo",
            version_label: "Version",
            author_label: "Author",
            file_label: "File"
          }
        }
      },
      footer: { title: "Ready to<br/>Collaborate?", desc: "If you require more detailed information or wish to discuss a potential collaboration, please feel free to reach out.", copy: "© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED." }
    }
  },
  ja: {
    translation: {
      nav: { about: "我々について", works: "作品", contact: "お問い合わせ", menu: "メニュー", nav_maps: "マップ制作", nav_maps_be: "統合版 / NetEase版", nav_maps_je: "Java版", nav_mods: "MOD開発", nav_tools: "プラグイン・ツール" },
      hero: { gen: "世界を生成中...", crafting: "創造", worlds: "無限", sub: "コマンドで法則を再構築し、ロジックでバニラを刷新する。<br/>トップクラスのMinecraftゲームプレイ開発に専念し、常識を覆すPVP、RPG、謎解きのマップ体験を提供します。", scroll: "スクロール" },
      marq: { pvp: "PVP アリーナ", rpg: "RPG アドベンチャー", puz: "謎解きマップ", vdl: "ボクセルデザイン", jve: "Java版 ネイティブ" },
      about: { tag: "マニフェスト", title: "境界を越え、<br />サンドボックスを再定義する", desc: "Fimel スタジオは2019年に設立されました。初期は主に中国版『Minecraft』（NetEase版）に注力しており、PvP、PvE、RPG、脱出、建築など様々なジャンルのマップ制作を行ってきました。そこでの驚異的なダウンロード数と成功を経て、現在私たちはJava版ネイティブへと活動を広げ、プレイヤーの常識を覆す体験を提供し続けています。", y1: "2019", y1_sub: "設立年", y2: "10+", y2_sub: "総発行作品", render: "コアブロックをレンダリング" },
      process: { title: "次元", p1: "視覚設計", p1_sub: "ゼロからの美学", p2: "地形生成", p2_sub: "何十億ものブロック規模", p3: "機構構築", p3_sub: "システム再構築", p4: "没入体験", p4_sub: "多次元のインタラクション" },
      core: { tag: "専門分野", pvp: "PvP & PvE 戦闘", pvp_d: "極めて高速な判定のスキル対人戦や職業バランス設計、およびハードコアなPvEサバイバルと地形探索。", rpg: "RPG & ストーリー脱出", rpg_d: "壮大な箱庭世界感とカスタムモデルの細部を作り込み、没入感のあるストーリーテリングと高難易度の密室脱出を融合。", puz: "ボクセル建築 & 機構", puz_d: "視覚を圧倒する壮大な建築をゼロから構築し、バニラのレッドストーンと高度なデータパックを組み合わせて既存ロジックを再構築。" },
      team: { 
        tag: "コアチーム", 
        role1: "創設者 / プランナー", 
        role2: "リードプログラマー", 
        role3: "アートディレクター", 
        role4: "レベルデザイナー" 
      },
      works: { 
        title: "これまでの<br/>代表作", inquire: "アクセス申請", 
        category_maps: "マップ制作 / MAPS",
        category_mods: "MOD開発 / MODS",
        category_tools: "プラグイン・ツール / TOOLS",
        m1_t: "狼人殺 F小镇", m1_c: "人狼風 PvP", m1_d: "10万+DL。NetEase版での傑作人狼風サバイバルマップ。",
        m2_t: "饥饿游戏：旧城迷行", m2_c: "サバイバル PvP", m2_d: "5万+DL。廃墟となった旧市街での極限サバイバル。",
        m3_t: "ABYSS天坑", m3_c: "Hypixel系 PvP", m3_d: "1千+DL。深淵に落ち、暗闇の中で生存を探求する傑作。",
        m4_t: "FML空生自然竞技场", m4_c: "オリジナル職業 PvP", m4_d: "1万+DL。虚空に浮かぶ競技場で純粋な戦闘と剣術で勝者を決める。",
        m5_t: "逃走中", m5_c: "対戦マップ", m5_d: "1万+DL。日本の番組を参考にしたスリリングな鬼ごっこ。",
        m6_t: "通電2：雪域危機", m6_c: "非対称対戦ゲーム風", m6_d: "1万+DL。極地基地に潜入し、発電機を再起動する。",
        m7_t: "海岛逃生：黎明前夕", m7_c: "感染/タワー修復 PvP", m7_d: "1万+DL。隔絶された島での絶望と秘密の探索。",
        m8_t: "紫晶幻域：救世光源", m8_c: "ストーリー重視 RPG", m8_d: "1万+DL。壮大な物語とカスタムモデルの初の大規模RPG。",
        m9_t: "海岛逃生：黎明前夕 (Java版)", m9_c: "感染/タワー修復 PvP", m9_d: "クラシックな孤島サバイバルゲームのJava版リメイク。より複雑なシステムを再構築。",
        m10_t: "ネタバレが多すぎるRPG", m10_c: "ストーリー RPG", m10_d: "KSBスタジオの原作に基づいた、Java版没入型ストーリーRPG。",
        mod1_t: "未定のMODプロジェク", mod1_c: "システム拡張", mod1_d: "さらにハードコアなエンジン拡張と独立したMODが開発中です。ご期待ください。",
        tool1_t: "開発ツールチェーン", tool1_c: "ワークフロー", tool1_d: "データパックとプラグインアーキテクチャに基づく、カスタムな視覚的開発支援と最適化スクリプトフレームワーク。",
        view: "詳細を見る",
        open_detail_aria: "NetEaseリソースセンターで{{title}}を開く",
        downloads_metric: "{{downloads}} ダウンロード",
        rating_metric: "{{rating}} 評価",
        comments_metric: "{{comments}} コメント / {{remarks}} レビュー",
        released_metric: "公開日 {{date}}",
        bedrockMaps: {
          werewolfFTown: {
            title: "人狼殺：Fタウン",
            subtitle: "Werewolf: F-Town",
            category: "NetEase統合版マップ",
            genre: "人狼 PvP / 推理サバイバル",
            desc: "開始時に探偵、人狼、村人がランダムに割り当てられます。人狼は探偵と村人を狩り、探偵は弓で人狼を見抜き、村人は資源を集めて矢を買い反撃します。",
            players: "多人数推理",
            components: ["ランダム役職", "探偵の弓", "コイン購入", "人狼陣営"]
          },
          hungerGamesOldCity: {
            title: "ハンガーゲーム：旧市街迷行",
            subtitle: "Hunger Games: Old City",
            category: "NetEase統合版マップ",
            genre: "サバイバル競技 / PvP",
            desc: "廃墟となった旧市街でのサバイバル乱戦です。才能を選んで分散スポーンし、TNTで物資を集め、金床、作業台、特殊エリア、アイテムを活用して勝利を目指します。",
            players: "多人数乱闘",
            components: ["12種類の才能", "TNT物資", "特殊エリア", "デスマッチ"]
          },
          abyssSkyPit: {
            title: "ABYSS天坑",
            subtitle: "Abyss Sky Pit",
            category: "NetEase統合版マップ",
            genre: "乱闘 PvP / 1v1",
            desc: "多人数乱闘PvPを中心に、純粋な1v1対戦にも対応したマップです。強化された弓、ブロックを壊せる雪玉、連続キル演出、ブロックスキンが戦況を変化させます。",
            players: "多人数 / 1v1",
            components: ["強化遠距離武器", "スキルシステム", "連続キル通知", "ブロックスキン"]
          },
          fmlSkyNatureArena: {
            title: "FML空生自然アリーナ職業大乱闘",
            subtitle: "FML Sky Nature Arena",
            category: "NetEase統合版マップ",
            genre: "職業大乱闘 PvP",
            desc: "24種類の職業で戦うクラス制PvP乱闘マップです。死亡ランキング、ウィザーストーム、爆発矢、視界妨害など、複数のルール設定を切り替えられます。",
            players: "多人数職業戦",
            components: ["24種類の職業", "死亡ランキング", "モード設定", "特殊ルール"]
          },
          runForMoney: {
            title: "逃走中",
            subtitle: "Run For Money",
            category: "NetEase統合版マップ",
            genre: "追跡競技 / PvP",
            desc: "ランダムなプレイヤーが標的となり、他のプレイヤーはハンターとして追跡します。標的はチェストから道具を探して追跡ラウンドを生き延び、最後のPvPで生存を目指します。",
            players: "多人数競技",
            components: ["ランダム標的", "ハンター追跡", "アイテムチェスト", "最終PvP"]
          },
          powerOn2SnowCrisis: {
            title: "通電2：雪域危機",
            subtitle: "Power On 2: Snow Crisis",
            category: "NetEase統合版マップ",
            genre: "非対称パズルサバイバル",
            desc: "『通電』シリーズの最終章です。荒廃した極地研究施設に入り、厳寒の中で発電機を再起動し、施設をめぐるロジックパズルを解きます。",
            players: "多人数協力",
            components: ["発電機再起動", "極地研究施設", "ロジックパズル", "サバイバル攻略"]
          },
          islandEscapeBeforeDawn: {
            title: "海島脱出：夜明け前",
            subtitle: "Island Escape: Before Dawn",
            category: "NetEase統合版マップ",
            genre: "感染脱出 / 陣営対抗",
            desc: "4〜8人向けの脱出マップです。人間陣営は島の5つの信号塔を修理してヘリの救助を待ち、感染者陣営は修理を妨害して感染を広げます。",
            players: "4〜8人",
            components: ["人間/感染者陣営", "5つの信号塔", "職業協力", "ヘリ撤収"]
          },
          amethystSalvation: {
            title: "紫晶幻域：救世光源",
            subtitle: "Amethyst: Salvation",
            category: "NetEase統合版マップ",
            genre: "RPG冒険 / ストーリー",
            desc: "幻想大陸が闇の勢力に覆われています。職業を選び、始まりの村から旅立ち、道具購入と装備強化を重ねながら、紫水晶の魔法で召喚された亡霊を倒します。",
            players: "多人数RPG",
            components: ["職業選択", "ストーリー攻略", "装備強化", "亡霊の敵"]
          }
        }
      },
      workPages: {
        back_home: "ホームへ戻る",
        open_external: "マップリンクを開く",
        search_placeholder: "マップ、モード、コンポーネントを検索...",
        catalog_title: "コンテンツ索引",
        no_results: "一致するマップが見つかりません",
        clear_search: "検索をクリア",
        download_count_metric: "累計ダウンロード {{count}} 件",
        download_count_loading: "ダウンロード数を読み込み中",
        download_count_pending: "Supabase接続後に表示",
        view_bedrock: "統合版マップをすべて見る",
        view_java: "Java版を見る",
        stats: { projects: "内容数", platform: "主要プラットフォーム", mode: "状態" },
        status: { live: "公開済み", wip: "開発中", prototype: "プロトタイプ再構築", design: "企画設計", released_research: "公開済み / 研究開発" },
        maps: {
          eyebrow: "作品 / マップ",
          title: "マップ制作",
          desc: "ホームページを入口として残し、このページではFimelのマップカタログを集約します。公開済みのNetEase統合版マップ、Java版の企画、展開可能なゲームプレイ分類を、ホームと同じボクセル、ピクセル、高コントラストの表現で整理します。",
          catalog: "注目マップカタログ"
        },
        bedrock: {
          eyebrow: "マップ / 統合版",
          title: "NetEase統合版マップ",
          desc: "NetEaseリソースセンターで公開された統合版マップをまとめたページです。各項目にはカバー、タイプ、ダウンロード数、評価、コンポーネントタグ、外部リンクを保持しています。",
          catalog: "統合版マップライブラリ"
        },
        java: {
          eyebrow: "マップ / Java",
          title: "Java版マップ",
          desc: "Java版ネイティブ向けに移植または再設計しているプロジェクトです。サーバーロジック、データパック、プラグイン連携、より自由なマルチプレイ体験を重視します。",
          project1_tags: ["Java再構築", "感染脱出", "タワー協力", "コア機構"],
          project2_tags: ["ストーリーRPG", "クエストチェーン", "カスタムシステム", "世界観"]
        },
        mods: {
          eyebrow: "作品 / MOD",
          title: "MOD開発",
          desc: "カスタム機構、サーバー補助、将来的な独立MODに向けた低レイヤーのシステム拡張です。現在は研究開発と事前制作の方向性を中心に展示しています。",
          tags: ["システム拡張", "機構プロトタイプ", "サーバー連携", "開発中"]
        },
        tools: {
          eyebrow: "作品 / ツール",
          title: "プラグイン・ツール",
          desc: "Fimelのマップ制作工程から生まれたスクリプト、プラグイン、データ処理、視覚的な補助ツールです。複雑なゲームプレイの制作、デバッグ、保守を支援します。",
          tags: ["ワークフロー", "データパック補助", "プラグインツール", "自動化"],
          objCubizer: {
            title: "Minecraft OBJ キューブ変換ツール",
            subtitle: "Minecraft OBJ Cubizer",
            category: "Blockbench デスクトッププラグイン",
            status: "v1.0.0 安定版",
            desc: "Minewaysなどから書き出したMinecraft建築OBJを、BlockbenchのJava Block/Item用キューブモデルへ変換します。軸に沿った直方体を再構築し、MTLとPNGテクスチャを読み込み、OBJテクスチャをリソースパックフォルダへ書き出せるため、Animated Javaのバニラアニメーション制作に接続しやすくなります。",
            tags: ["OBJをキューブ化", "MTL/PNGテクスチャ", "Java Block/Item", "リソースパック出力", "Animated Java"],
            download: "プラグインをダウンロード",
            repo: "GitHub リポジトリを見る",
            version_label: "バージョン",
            author_label: "作者",
            file_label: "ファイル"
          }
        }
      },
      footer: { title: "協業の<br/>ご検討を", desc: "より詳しい情報について、あるいは協業をご検討の際は、いつでもお気軽にご連絡ください。", copy: "© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED." }
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
