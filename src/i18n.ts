import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { contentMessages } from './content/messages';

const resources = {
  zh: {
    translation: {
      ...contentMessages.zh,
      nav: { home: "主页", about: "关于我们", works: "作品", primary: "主导航", language: "切换语言", theme_light: "切换至亮色", theme_dark: "切换至暗色", skip_content: "跳转到内容", contact: "联络合作", menu: "菜单", nav_maps: "地图作品", nav_maps_all: "全部地图", nav_maps_be: "基岩版 / 网易版", nav_maps_je: "Java 版地图", nav_datapacks: "数据包", nav_mods: "模组 / MODS", nav_tools: "插件与工具" },
      hero: { gen: "世界生成中...", crafting: "构筑", worlds: "无限", sub: "期盼在 MC 中玩到任何游戏", scroll: "向下滑动" },
      siteMeta: {
        bingoCategory: 'Minecraft 1.21.11 · Fabric 模组',
        bingoSubtitle: '竞技玩法模组',
        bingoDescription: '将“不要做挑战”融入 Bingo 对局中，兼有队伍共享生命、对抗词条、特殊事件与可选语音关键词多种玩法。目前仅有1.21.11版本，后续将持续更新至最新版本。',
        bingoTags: ['Bingo 对局', 'DDI 规则', '356 条词条', '可选语音实验'],
        contactLabels: ['项目合作', '创作者联动', '玩家反馈 / 技术支持'],
        studio: {
          originTitle: "正在制作与已经发布",
          originBody: "21 项网易基岩版作品已发布，包括地图与音乐制作命令包；两个 Java 版地图与 Fimel Card 卡牌桌游数据包正在制作。Bingo But Don't Do It 和 Minecraft OBJ Cubizer 已开放下载。之后，我们也想尝试 Minecraft 之外的游戏和互动作品。",
          milestones: [],
          principles: []
        }
      },
      home: {
        studio_label: "Minecraft 创作工作室",
        featured_cta: "浏览作品",
        current_cta: "Java 版地图",
        status_java: "2 个 Java 版地图制作中",
        status_maps: "21 项网易作品已发布",
        quick_tag: "作品",
        quick_title: "地图、数据包、模组和创作工具",
        maps_title: "地图作品",
        maps_featured: "海岛逃生：黎明前夕",
        maps_desc: "网易基岩版地图已发布，Java 版地图正在制作。",
        mods_title: "模组",
        mods_featured: "Bingo But Don't Do It",
        mods_desc: "在 Bingo 对局里躲开禁止目标，支持队伍共享生命和特殊事件。",
        tools_title: "插件与工具",
        tools_featured: "Minecraft OBJ Cubizer",
        tools_desc: "把建筑 OBJ 或结构文件转换成可编辑的 Blockbench 方块模型。",
        enter: "查看"
      },
      marq: { pvp: "PvP / PvE", rpg: "RPG 冒险", puz: "解谜与逃生", vdl: "地图建筑", jve: "模组与工具" },
      about: { tag: "关于 Fimel", title: "原神，<br />启动。", desc: "Fimel 成立于 2019 年，从 Minecraft 地图制作开始。现在，我们也在制作模组和创作者工具。", y1: "2019", y1_sub: "成立年份", y2: "21", y2_sub: "已发布网易作品", render: "拖动方块试试" },
      process: { title: "制作内容", p1: "场景设计", p1_sub: "建筑、模型与环境", p2: "地形制作", p2_sub: "地图与探索路线", p3: "玩法逻辑", p3_sub: "命令、红石与数据包", p4: "任务与剧情", p4_sub: "关卡流程与故事" },
      core: { tag: "我们擅长什么", pvp: "对战与生存玩法", pvp_d: "设计职业、技能和对局规则，制作 PvP 对抗与 PvE 合作玩法。", rpg: "冒险、解谜与逃生", rpg_d: "制作剧情、任务与关卡，把探索、解谜和逃生串成完整的游玩流程。", puz: "建筑与游戏逻辑", puz_d: "制作场景和建筑，用命令、红石与数据包实现玩法，也开发模组和工具。" },
      team: { 
        tag: "团队成员",
        role1: "创始人 / 策划 / 建筑", 
        role2: "主程序 / 逻辑机制", 
        role3: "视觉设计 / 美术", 
        role4: "关卡交互 / 环境构建" 
      },
      works: {
        title: "精选<br/>作品", inquire: "联系工作室",
        category_maps: "地图作品",
        category_mods: "模组",
        category_tools: "插件与工具",
        m1_t: "狼人杀：F小镇", m1_c: "狼人杀 PvP", m1_d: "网易版现象级角色扮演与推理生存地图。",
        m2_t: "饥饿游戏：旧城迷行", m2_c: "PvP 竞技", m2_d: "基于旧城废墟的冒险与杀戮。",
        m3_t: "ABYSS天坑", m3_c: "Hypixel系 PvP", m3_d: "跌落深渊，在黑暗与绝望中寻找生机。",
        m4_t: "FML空生自然竞技场", m4_c: "原创职业 PvP", m4_d: "悬浮于虚空之上的竞技擂台，用纯粹的战斗与走位决出真正的胜者。",
        m5_t: "逃走中", m5_c: "对战地图", m5_d: "参考日本节目《全员逃走中》的作品。紧张刺激的隐蔽与追脱玩法，在庞大迷宫中完成任务并躲避猎人追捕。",
        m6_t: "通电2：雪域危机", m6_c: "非对称对战游戏风", m6_d: "深入破败的极地科考站，重启发电机，面对未知的寒冬与硬核逻辑谜题。",
        m7_t: "海岛逃生：黎明前夕", m7_c: "感染/塔防 PvP", m7_d: "具有复杂的建筑结构的遗世孤岛，在绝境中发掘不为人知的惊天秘密。",
        m8_t: "紫晶幻域：救世光源", m8_c: "剧情驱动 RPG", m8_d: "结合宏大沉浸叙事与定制化模型构建史诗级世界观的独立大型作品。",
        m9_t: "海岛逃生：黎明前夕 (Java版)", m9_c: "感染/塔防 PvP", m9_d: "感染逃生与塔防玩法的 Java 版地图，目前正在制作。",
        m10_t: "剧透过多的RPG：最终的敌人是勇者的父亲", m10_c: "沉浸式 RPG", m10_d: "剧情和任务驱动的 Java 版 RPG，目前正在制作。",
        mod1_t: "未定模组项目", mod1_c: "系统扩充", mod1_d: "更多硬核引擎拓展与独立模组正在研发中，敬请期待。",
        tool1_t: "开发工具链", tool1_c: "工作流集", tool1_d: "基于数据包与插件架构定制的可视化开发辅助与优化脚本框架。",
        view: "查看详情",
        open_detail_aria: "查看 {{title}} 的作品详情",
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
            desc: "旧城中的自由混战。玩家选择天赋后分散出生，通过 TNT 获取物资，并利用铁砧、工作台、特殊区域与道具争夺最终胜利。",
            players: "多人乱斗",
            components: ["12 种天赋", "TNT 物资", "特殊地区", "死斗玩法"]
          },
          abyssSkyPit: {
            title: "ABYSS天坑",
            subtitle: "Abyss Sky Pit",
            category: "网易基岩版地图",
            genre: "乱斗 PvP / 1v1",
            desc: "以多人乱斗 PvP 为主，也提供纯净 1v1 对战。强化弓箭、使方块变得易碎的雪球、击杀连播与方块皮肤系统让战局持续变化。",
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
            genre: "通电系列最终章",
            desc: "《通电》最终章，由建造老E与水晶215制作。具体玩法与规则在地图内说明。",
            players: "详见地图内说明",
            components: ["通电系列", "最终章", "地图内玩法说明"]
          },
          islandEscapeBeforeDawn: {
            title: "海岛逃生--黎明前夕",
            subtitle: "Island Escape: Before Dawn",
            category: "网易基岩版地图",
            genre: "感染逃生 / 阵营对抗",
            desc: "4-8 人逃生地图。人类阵营修复信号塔，使信号进度达到 100% 后等待直升机撤离，感染者则要阻止修复并扩散感染。",
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
        view_java: "查看 Java 版地图",
        stats: { projects: "内容数量", platform: "主要平台", mode: "状态" },
        status: { live: "已发布", wip: "开发中", prototype: "原型重构", design: "企划设计", released_research: "已发布 / 预研中" },
        maps: {
          eyebrow: "地图作品 / 总览",
          title: "地图作品",
          desc: "汇集 Fimel 已发布与正在制作的地图内容。你可以进入网易基岩版作品库，或查看正在开发的 Java 版地图。数据包作品单独收录在作品目录的数据包分类中。",
          catalog: "地图目录"
        },
        bedrock: {
          eyebrow: "地图作品 / 基岩版",
          title: "网易基岩版地图",
          desc: "收录已在网易 Minecraft 资源中心发布的基岩版地图，覆盖 PvP、PvE、RPG、解谜与逃生等玩法。由于平台入口限制，本站提供封面、玩法信息与资源中心入口。",
          catalog: "基岩版地图库"
        },
        java: {
          eyebrow: "地图作品 / Java",
          title: "Java 版地图",
          desc: "展示正在制作的 Java 版地图，发布状态会随开发进度更新。数据包作品可在独立的数据包分类中查看。",
          project1_tags: ["Java 重构", "感染逃生", "塔防协作", "核心机制"],
          project2_tags: ["剧情 RPG", "任务链", "定制系统", "世界观"]
        },
        mods: {
          eyebrow: "模组 / 已发布与实验",
          title: "模组",
          desc: "收录 Fimel 开发的可游玩模组与机制实验。当前可体验项目为 Bingo But Don't Do It，后续项目会按完成度和维护状态加入。",
          tags: ["玩法模组", "机制重构", "Fabric", "已发布"],
          download_latest: "下载",
          download_loading: "正在获取最新版",
          download_fallback: "打开 Releases 页面",
          download_error: "暂时无法自动获取最新版，请点击按钮前往 Releases 页面下载。"
        },
        tools: {
          eyebrow: "插件与工具 / 创作工作流",
          title: "插件与工具",
          desc: "收录 Fimel 在地图制作和技术美术流程中开发的插件与辅助工具。当前已发布 Minecraft OBJ Cubizer，并提供下载、版本与 GitHub 入口。",
          tags: ["Blockbench 插件", "模型转换", "创作工作流", "已发布"],
          objCubizer: {
            title: "Minecraft OBJ 方块转换器",
            subtitle: "Minecraft OBJ Cubizer",
            category: "Blockbench 桌面插件",
            status: "v1.4.0 发布版",
            desc: "将 Minecraft 建筑 OBJ 和结构文件转换为可编辑的 Blockbench Java 方块模型，支持直接导入 schematic、schem、litematic、结构 NBT 与单个 MCA 区域文件，并可读取原版或资源包中的特殊方块模型、修正贴图路径、导出 OBJ 贴图到资源包目录。",
            tags: ["OBJ / 结构导入", "特殊方块支持", "资源包 / Jar 贴图", "Java Block/Item", "独立菜单"],
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
      ...contentMessages.en,
      nav: { home: "Home", about: "About", works: "Works", primary: "Main navigation", language: "Change language", theme_light: "Use light theme", theme_dark: "Use dark theme", skip_content: "Skip to content", contact: "Contact", menu: "Menu", nav_maps: "Maps", nav_maps_all: "All Maps", nav_maps_be: "Bedrock / NetEase", nav_maps_je: "Java Maps", nav_datapacks: "Data Packs", nav_mods: "Mods", nav_tools: "Tools & Plugins" },
      hero: { gen: "GENERATING WORLD...", crafting: "CRAFTING", worlds: "WORLDS", sub: "We make Minecraft maps, mods and tools for creators.", scroll: "Scroll" },
      siteMeta: {
        bingoCategory: 'Minecraft 1.21.11 · Fabric Mod',
        bingoSubtitle: 'Competitive Minecraft Mod',
        bingoDescription: 'A rework of the “Don’t Do It” challenge inside Bingo matches: shared team lives, opposing objectives, special events, and optional voice-keyword play.',
        bingoTags: ['Bingo matches', 'DDI rules', '356 objectives', 'Optional voice'],
        contactLabels: ['Project collaboration', 'Creator collaboration', 'Player feedback / technical support'],
        studio: {
          originTitle: "Released works and current projects",
          originBody: "21 NetEase Bedrock works are released, including maps and a music command pack; two Java maps and the Fimel Card tabletop data pack are in development. Bingo But Don't Do It and Minecraft OBJ Cubizer are available to download. We also hope to explore games and interactive projects beyond Minecraft.",
          milestones: [],
          principles: []
        }
      },
      home: {
        studio_label: "Minecraft creative studio",
        featured_cta: "Browse works",
        current_cta: "Java maps",
        status_java: "2 Java maps in development",
        status_maps: "21 NetEase works released",
        quick_tag: "Works",
        quick_title: "Maps, data packs, mods and creator tools",
        maps_title: "Maps",
        maps_featured: "Island Escape: Before Dawn",
        maps_desc: "Released NetEase Bedrock maps and Java maps in development.",
        mods_title: "Mods",
        mods_featured: "Bingo But Don't Do It",
        mods_desc: "Avoid forbidden objectives in Bingo matches, with shared team lives and special events.",
        tools_title: "Plugins & Tools",
        tools_featured: "Minecraft OBJ Cubizer",
        tools_desc: "Convert building OBJ exports or structure files into editable Blockbench cube models.",
        enter: "View"
      },
      marq: { pvp: "PvP / PvE", rpg: "RPG adventures", puz: "Puzzles & escapes", vdl: "Map building", jve: "Mods & tools" },
      about: { tag: "About Fimel", title: "Maps and mods.<br />Tools for creators.", desc: "Fimel was founded in 2019, starting with Minecraft maps. We now make mods and tools for creators as well.", y1: "2019", y1_sub: "Founded", y2: "21", y2_sub: "NetEase works released", render: "Try dragging the cube" },
      process: { title: "What we make", p1: "Scene design", p1_sub: "Buildings, models and environments", p2: "Terrain", p2_sub: "Maps and exploration routes", p3: "Game logic", p3_sub: "Commands, redstone and data packs", p4: "Quests & stories", p4_sub: "Level progression and narrative" },
      core: { tag: "What we do", pvp: "Combat & survival", pvp_d: "We design classes, skills and match rules for competitive PvP and cooperative PvE.", rpg: "Adventure, puzzles & escapes", rpg_d: "We build stories, quests and levels that connect exploration, puzzles and escape challenges.", puz: "Building & game logic", puz_d: "We create scenes and buildings, implement gameplay with commands, redstone and data packs, and develop mods and tools." },
      team: { 
        tag: "Team",
        role1: "Founder / Game Designer", 
        role2: "Lead Programmer / Logic", 
        role3: "Visual & Art Director", 
        role4: "Level & Env Designer" 
      },
      works: {
        title: "Selected<br/>works", inquire: "Contact Fimel",
        category_maps: "Maps",
        category_mods: "Mods",
        category_tools: "Plugins & Tools",
        m1_t: "WEREWOLF: F-TOWN", m1_c: "Werewolf PvP", m1_d: "A phenomenal werewolf-style survival map on NetEase Edition.",
        m2_t: "HUNGER GAMES: OLD CITY", m2_c: "Battle Royale PvP", m2_d: "Adrenaline-pumping survival game set in ruined cityscapes.",
        m3_t: "ABYSS", m3_c: "Hypixel-style PvP", m3_d: "Fall into the abyss and seek survival in darkness and despair.",
        m4_t: "FML: SKY NATURE ARENA", m4_c: "Original Class PvP", m4_d: "A combat stage suspended in the void. Rely on pure combat and swordsmanship.",
        m5_t: "RUN FOR MONEY", m5_c: "Competitive Map", m5_d: "A thrilling hide-and-seek experience based on the Japanese show.",
        m6_t: "POWER ON 2: SNOW CRISIS", m6_c: "Asymmetrical PvP", m6_d: "Delve into a ruined polar station, restart the generators to survive.",
        m7_t: "ISLAND ESCAPE: BEFORE DAWN", m7_c: "Infection/Tower PvP", m7_d: "A solitary island with complex structures. Discover hidden secrets.",
        m8_t: "AMETHYST: SALVATION", m8_c: "Story-driven RPG", m8_d: "Our first large-scale RPG project. Combines grand narratives with custom models.",
        m9_t: "ISLAND ESCAPE: BEFORE DAWN (Java Ed.)", m9_c: "Infection/Tower PvP", m9_d: "A Java map built around infection escape and tower-defense gameplay. In development.",
        m10_t: "TOO MANY SPOILERS RPG", m10_c: "Immersive RPG", m10_d: "A Java RPG built around stories and quests. In development.",
        mod1_t: "Untitled Mod Project", mod1_c: "System Expansion", mod1_d: "More hardcore engine expansions & standalone mods are in development.",
        tool1_t: "Dev Toolchain", tool1_c: "Workflow Set", tool1_d: "Custom visual dev helpers and optimization scripts based on datapacks & plugins.",
        view: "View Details",
        open_detail_aria: "View project details for {{title}}",
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
            desc: "Players are randomly assigned as detective, werewolf, or villager. Werewolves hunt the detective and villagers, the detective uses a bow to identify threats, and villagers collect resources to buy arrows and fight back.",
            players: "Multiplayer deduction",
            components: ["Random roles", "Detective bow", "Coin shop", "Werewolf team"]
          },
          hungerGamesOldCity: {
            title: "Hunger Games: Old City",
            subtitle: "Hunger Games: Old City",
            category: "NetEase Bedrock Map",
            genre: "Survival Battle / PvP",
            desc: "A free-for-all survival battle in an old city. Choose a talent, spawn apart, gather loot through TNT, and use crafting stations, special zones, and items to fight for the final win.",
            players: "Multiplayer brawl",
            components: ["12 talents", "TNT loot", "Special zones", "Deathmatch mode"]
          },
          abyssSkyPit: {
            title: "Abyss Sky Pit",
            subtitle: "Abyss Sky Pit",
            category: "NetEase Bedrock Map",
            genre: "Brawl PvP / 1v1",
            desc: "A PvP arena focused on multiplayer brawls with a clean 1v1 mode as well. Enhanced bows, snowballs that make blocks brittle, kill streak broadcasts, and block skins keep each match shifting.",
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
            genre: "Power On finale",
            desc: "The final chapter of Power On, created by 建造老E and 水晶215. Gameplay and rules are explained inside the map.",
            players: "See in-map instructions",
            components: ["Power On series", "Final chapter", "In-map instructions"]
          },
          islandEscapeBeforeDawn: {
            title: "Island Escape: Before Dawn",
            subtitle: "Island Escape: Before Dawn",
            category: "NetEase Bedrock Map",
            genre: "Infection Escape / Team Clash",
            desc: "A 4-8 player escape map. Humans repair signal towers until signal progress reaches 100% and wait for helicopter extraction, while the infected team blocks repairs and spreads infection.",
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
        view_java: "View Java Maps",
        stats: { projects: "Content Count", platform: "Main Platform", mode: "Status" },
        status: { live: "Released", wip: "In Development", prototype: "Prototype Rebuild", design: "Design Phase", released_research: "Released / R&D" },
        maps: {
          eyebrow: "Maps / Overview",
          title: "Map Projects",
          desc: "A catalogue of Fimel maps, from released NetEase Bedrock projects to Java maps currently in production. Data packs have their own category in the works catalogue.",
          catalog: "Map Catalogue"
        },
        bedrock: {
          eyebrow: "Maps / Bedrock",
          title: "NetEase Bedrock Maps",
          desc: "Released NetEase Minecraft Bedrock maps spanning PvP, PvE, RPG, puzzles, and escape experiences. Because access is platform-restricted, each entry provides its cover, gameplay details, and Resource Center link.",
          catalog: "Bedrock Map Library"
        },
        java: {
          eyebrow: "Maps / Java",
          title: "Java Maps",
          desc: "Java maps currently in production. Release status will be updated as development progresses; data packs are listed in their own category.",
          project1_tags: ["Java rebuild", "Infection escape", "Tower teamwork", "Core mechanics"],
          project2_tags: ["Story RPG", "Quest chain", "Custom systems", "Worldbuilding"]
        },
        mods: {
          eyebrow: "Mods / Releases & Experiments",
          title: "Mods",
          desc: "Playable mods and mechanic experiments developed by Fimel. Bingo But Don't Do It is available now; future projects will be added according to completion and maintenance status.",
          tags: ["Gameplay mod", "Mechanic rework", "Fabric", "Released"],
          download_latest: "Download Latest Release",
          download_loading: "Finding Latest Release",
          download_fallback: "Open Releases Page",
          download_error: "The latest release could not be retrieved automatically. Use the button to download it from the Releases page."
        },
        tools: {
          eyebrow: "Plugins & Tools / Creator Workflow",
          title: "Plugins & Tools",
          desc: "Plugins and utilities developed through Fimel's map-production and technical-art workflow. Minecraft OBJ Cubizer is available now with download, version, and GitHub links.",
          tags: ["Blockbench plugin", "Model conversion", "Creator workflow", "Released"],
          objCubizer: {
            title: "Minecraft OBJ Cubizer",
            subtitle: "Minecraft OBJ Cubizer",
            category: "Blockbench Desktop Plugin",
            status: "v1.4.0 Release",
            desc: "Converts Minecraft building OBJ exports and structure files into editable Blockbench Java cube models. It supports direct import for schematic, schem, litematic, structure NBT, and single MCA region files, reads special block models from vanilla or resource-pack JSON, fixes texture paths, and exports OBJ textures into a resource-pack folder.",
            tags: ["OBJ + structure import", "Special block support", "Resource pack / Jar textures", "Java Block/Item", "Dedicated menu"],
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
      ...contentMessages.ja,
      nav: { home: "ホーム", about: "私たちについて", works: "作品", primary: "メインナビゲーション", language: "言語を変更", theme_light: "ライトテーマに変更", theme_dark: "ダークテーマに変更", skip_content: "コンテンツへ移動", contact: "お問い合わせ", menu: "メニュー", nav_maps: "マップ作品", nav_maps_all: "すべてのマップ", nav_maps_be: "統合版 / NetEase版", nav_maps_je: "Java版マップ", nav_datapacks: "データパック", nav_mods: "MOD", nav_tools: "プラグイン・ツール" },
      hero: { gen: "世界を生成中...", crafting: "創造", worlds: "無限", sub: "Minecraft のマップ、MOD、クリエイター向けツールを制作しています。", scroll: "スクロール" },
      siteMeta: {
        bingoCategory: 'Minecraft 1.21.11 · Fabric MOD',
        bingoSubtitle: '対戦型 Minecraft MOD',
        bingoDescription: '「やってはいけない」チャレンジを Bingo の対戦ルールとして再構築。チーム共有ライフ、相手チームの禁止目標、特殊イベント、任意の音声キーワード機能によって、スピード勝負に継続的な駆け引きを加えます。',
        bingoTags: ['Bingo 対戦', 'DDI ルール', '356 種類の目標', '音声機能（任意）'],
        contactLabels: ['プロジェクト協業', 'クリエイター連携', 'プレイヤー / 技術サポート'],
        studio: {
          originTitle: "公開済みの作品と制作中のプロジェクト",
          originBody: "マップと音楽制作コマンドパックを含む NetEase 統合版作品 21 本を公開し、Java 版マップ 2 本と Fimel Card のカード・ボードゲーム用データパックを制作しています。Bingo But Don't Do It と Minecraft OBJ Cubizer はダウンロードできます。今後は Minecraft 以外のゲームやインタラクティブな作品にも挑戦したいと考えています。",
          milestones: [],
          principles: []
        }
      },
      home: {
        studio_label: "Minecraft 制作スタジオ",
        featured_cta: "作品を見る",
        current_cta: "Java 版マップ",
        status_java: "Java 版マップ 2 本を制作中",
        status_maps: "NetEase 作品 21 本を公開",
        quick_tag: "作品",
        quick_title: "マップ、データパック、MOD、制作ツール",
        maps_title: "マップ",
        maps_featured: "海岛逃生：黎明前夕",
        maps_desc: "NetEase 統合版マップは公開済み、Java 版マップは制作中です。",
        mods_title: "MOD",
        mods_featured: "Bingo But Don't Do It",
        mods_desc: "Bingo 対戦で禁止目標を避けるルール。チーム共有ライフや特殊イベントにも対応。",
        tools_title: "プラグイン・ツール",
        tools_featured: "Minecraft OBJ Cubizer",
        tools_desc: "建築 OBJ や構造ファイルを、編集可能な Blockbench のブロックモデルに変換。",
        enter: "見る"
      },
      marq: { pvp: "PvP / PvE", rpg: "RPG アドベンチャー", puz: "謎解き・脱出", vdl: "マップ建築", jve: "MOD・ツール" },
      about: { tag: "Fimel について", title: "マップと MOD、<br />制作を支えるツール。", desc: "Fimel は 2019 年に設立され、Minecraft のマップ制作から活動を始めました。現在は MOD やクリエイター向けツールも制作しています。", y1: "2019", y1_sub: "設立年", y2: "21", y2_sub: "公開済みの NetEase 作品", render: "ブロックをドラッグしてみよう" },
      process: { title: "制作内容", p1: "シーン設計", p1_sub: "建築・モデル・環境", p2: "地形制作", p2_sub: "マップと探索ルート", p3: "ゲームロジック", p3_sub: "コマンド・レッドストーン・データパック", p4: "クエストと物語", p4_sub: "ステージ進行とストーリー" },
      core: { tag: "得意なこと", pvp: "対戦とサバイバル", pvp_d: "職業、スキル、対戦ルールを設計し、PvP 対戦や協力型 PvE を制作します。", rpg: "冒険・謎解き・脱出", rpg_d: "物語、クエスト、ステージを制作し、探索や謎解き、脱出を一連の遊びにつなげます。", puz: "建築とゲームロジック", puz_d: "シーンや建築をつくり、コマンド、レッドストーン、データパックで遊びを実装します。MOD とツールも開発します。" },
      team: { 
        tag: "メンバー",
        role1: "創設者 / プランナー", 
        role2: "リードプログラマー", 
        role3: "アートディレクター", 
        role4: "レベルデザイナー" 
      },
      works: { 
        title: "ピックアップ<br/>作品", inquire: "Fimel に問い合わせる",
        category_maps: "マップ",
        category_mods: "MOD",
        category_tools: "プラグイン・ツール",
        m1_t: "狼人殺 F小镇", m1_c: "人狼風 PvP", m1_d: "10万+DL。NetEase版での傑作人狼風サバイバルマップ。",
        m2_t: "饥饿游戏：旧城迷行", m2_c: "サバイバル PvP", m2_d: "5万+DL。廃墟となった旧市街での極限サバイバル。",
        m3_t: "ABYSS天坑", m3_c: "Hypixel系 PvP", m3_d: "1千+DL。深淵に落ち、暗闇の中で生存を探求する傑作。",
        m4_t: "FML空生自然竞技场", m4_c: "オリジナル職業 PvP", m4_d: "1万+DL。虚空に浮かぶ競技場で純粋な戦闘と剣術で勝者を決める。",
        m5_t: "逃走中", m5_c: "対戦マップ", m5_d: "1万+DL。日本の番組を参考にしたスリリングな鬼ごっこ。",
        m6_t: "通電2：雪域危機", m6_c: "非対称対戦ゲーム風", m6_d: "1万+DL。極地基地に潜入し、発電機を再起動する。",
        m7_t: "海岛逃生：黎明前夕", m7_c: "感染/タワー修復 PvP", m7_d: "1万+DL。隔絶された島での絶望と秘密の探索。",
        m8_t: "紫晶幻域：救世光源", m8_c: "ストーリー重視 RPG", m8_d: "1万+DL。壮大な物語とカスタムモデルの初の大規模RPG。",
        m9_t: "海岛逃生：黎明前夕 (Java版)", m9_c: "感染/タワー修復 PvP", m9_d: "感染からの脱出とタワーディフェンスを中心にした Java 版マップ。現在制作中です。",
        m10_t: "ネタバレが多すぎるRPG", m10_c: "ストーリー RPG", m10_d: "物語とクエストを中心にした Java 版 RPG。現在制作中です。",
        mod1_t: "未定のMODプロジェク", mod1_c: "システム拡張", mod1_d: "さらにハードコアなエンジン拡張と独立したMODが開発中です。ご期待ください。",
        tool1_t: "開発ツールチェーン", tool1_c: "ワークフロー", tool1_d: "データパックとプラグインアーキテクチャに基づく、カスタムな視覚的開発支援と最適化スクリプトフレームワーク。",
        view: "詳細を見る",
        open_detail_aria: "{{title}}の作品詳細を見る",
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
            desc: "旧市街でのサバイバル乱戦です。才能を選んで分散スポーンし、TNTで物資を集め、金床、作業台、特殊エリア、アイテムを活用して勝利を目指します。",
            players: "多人数乱闘",
            components: ["12種類の才能", "TNT物資", "特殊エリア", "デスマッチ"]
          },
          abyssSkyPit: {
            title: "ABYSS天坑",
            subtitle: "Abyss Sky Pit",
            category: "NetEase統合版マップ",
            genre: "乱闘 PvP / 1v1",
            desc: "多人数乱闘PvPを中心に、純粋な1v1対戦にも対応したマップです。強化された弓、ブロックを壊れやすくする雪玉、連続キル演出、ブロックスキンが戦況を変化させます。",
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
            genre: "通電シリーズ最終章",
            desc: "建造老Eと水晶215が制作した『通電』シリーズの最終章です。遊び方とルールはマップ内で説明されています。",
            players: "マップ内の説明を参照",
            components: ["通電シリーズ", "最終章", "マップ内の説明"]
          },
          islandEscapeBeforeDawn: {
            title: "海島脱出：夜明け前",
            subtitle: "Island Escape: Before Dawn",
            category: "NetEase統合版マップ",
            genre: "感染脱出 / 陣営対抗",
            desc: "4〜8人向けの脱出マップです。人間陣営は信号塔を修理して信号の進捗を100%にし、ヘリの救助を待ちます。感染者陣営は修理を妨害して感染を広げます。",
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
        view_java: "Java版マップを見る",
        stats: { projects: "内容数", platform: "主要プラットフォーム", mode: "状態" },
        status: { live: "公開済み", wip: "開発中", prototype: "プロトタイプ再構築", design: "企画設計", released_research: "公開済み / 研究開発" },
        maps: {
          eyebrow: "マップ作品 / 一覧",
          title: "マップ制作",
          desc: "Fimel が公開・制作しているマップをまとめています。NetEase 統合版の公開作品と、開発中の Java版マップを確認できます。データパックは作品一覧の独立したカテゴリーに掲載しています。",
          catalog: "マップ一覧"
        },
        bedrock: {
          eyebrow: "マップ / 統合版",
          title: "NetEase統合版マップ",
          desc: "NetEase Minecraft リソースセンターで公開済みの統合版マップです。PvP、PvE、RPG、謎解き、脱出などを収録し、各作品からカバー、ゲーム内容、リソースセンターへの入口を確認できます。",
          catalog: "統合版マップライブラリ"
        },
        java: {
          eyebrow: "マップ / Java",
          title: "Java版マップ",
          desc: "制作中の Java版マップです。公開状況は進捗に合わせて更新します。データパックは独立したカテゴリーから確認できます。",
          project1_tags: ["Java再構築", "感染脱出", "タワー協力", "コア機構"],
          project2_tags: ["ストーリーRPG", "クエストチェーン", "カスタムシステム", "世界観"]
        },
        mods: {
          eyebrow: "MOD / 公開作品・実験",
          title: "MOD",
          desc: "Fimel が開発したプレイ可能な MOD とゲームメカニクス実験です。現在は Bingo But Don't Do It を公開しており、今後の作品は完成度とメンテナンス状況に応じて追加します。",
          tags: ["ゲームプレイ MOD", "機構再構築", "Fabric", "公開済み"],
          download_latest: "最新版をダウンロード",
          download_loading: "最新版を取得中",
          download_fallback: "Releases ページを開く",
          download_error: "最新版を自動取得できませんでした。ボタンから Releases ページを開いてダウンロードしてください。"
        },
        tools: {
          eyebrow: "プラグイン・ツール / 制作ワークフロー",
          title: "プラグイン・ツール",
          desc: "Fimel のマップ制作とテクニカルアート工程から生まれたプラグイン・補助ツールです。Minecraft OBJ Cubizer は公開済みで、ダウンロード、バージョン、GitHub の各入口を用意しています。",
          tags: ["Blockbench プラグイン", "モデル変換", "制作ワークフロー", "公開済み"],
          objCubizer: {
            title: "Minecraft OBJ キューブ変換ツール",
            subtitle: "Minecraft OBJ Cubizer",
            category: "Blockbench デスクトッププラグイン",
            status: "v1.4.0 リリース版",
            desc: "Minecraft 建築 OBJ と構造ファイルを、編集可能な Blockbench の Java 方塊モデルへ変換します。schematic、schem、litematic、構造 NBT、単一 MCA リージョンの直接読み込みに対応し、バニラやリソースパック由来の特殊ブロックモデル、テクスチャパス補正、OBJ テクスチャのリソースパック出力も扱えます。",
            tags: ["OBJ / 構造インポート", "特殊ブロック対応", "リソースパック / Jar テクスチャ", "Java Block/Item", "専用メニュー"],
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

const savedLanguage = (() => {
  try {
    const value = localStorage.getItem('fimel_user_lang');
    return value && ['zh', 'en', 'ja'].includes(value) ? value : 'zh';
  } catch { return 'zh'; }
})();

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
