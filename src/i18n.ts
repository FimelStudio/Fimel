import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  zh: {
    translation: {
      nav: { about: "关于我们", works: "作品阵列", contact: "联络合作", menu: "菜单" },
      hero: { gen: "世界生成中...", crafting: "构筑", worlds: "无限", sub: "以机制重组法则，用指令重制原版。<br/>专注于顶尖的 Minecraft 玩法构筑，为您提供远超常理的 PVP、RPG 及硬核解密地图游玩体验。", scroll: "向下滑动" },
      marq: { pvp: "PVP 竞技场", rpg: "RPG 沉浸冒险", puz: "硬核解密", vdl: "体素视觉设计", jve: "Java 原生架构" },
      about: { tag: "工作室宣言", title: "打破传统边界，<br />重塑沙盒交互。", desc: "Fimel 工作室成立于 2019 年。由于中国版 Minecraft（网易版）机制所限无法分享公开 URL，因此我们深感抱歉。我们在 PvP、PvE、RPG、逃生及建筑等多种类型上均有建树，并取得了众多现象级的下载成绩。如今，团队正进军 Java 原生端，在各大领域不断刷新玩家认知。", y1: "2019", y1_sub: "创立年份", y2: "10+", y2_sub: "总发行佳作", render: "核心方块载入完毕" },
      process: { title: "构筑维度", p1: "视觉设计", p1_sub: "从零开始的美学构筑", p2: "原生地形", p2_sub: "亿万级方块尺度演算", p3: "机制编程", p3_sub: "底层引擎逻辑重构", p4: "交互叙事", p4_sub: "多维沉浸感知设计" },
      core: { tag: "核心领域", pvp: "PvP & PvE 战斗", pvp_d: "涵盖极快判定的技能对抗与职业平衡设计，以及硬核的 PvE 生存玩法与地貌探索。", rpg: "RPG & 剧情逃生", rpg_d: "打造庞大的箱庭世界观、定制模型细节，并融合沉浸式剧情叙事与极具挑战的密室逃脱。", puz: "体素建筑 & 机制", puz_d: "从零构筑震撼视觉的史诗建筑，结合原生红石与高阶数据包重构底层逻辑。" },
      works: { 
        title: "入选<br/>作品", inquire: "获取游玩授权", 
        m1_t: "狼人杀：F小镇", m1_c: "狼人杀 PvP", m1_d: "网易版现象级角色扮演与推理生存地图。",
        m2_t: "饥饿游戏：旧城迷行", m2_c: "PvP 竞技", m2_d: "基于旧城废墟的冒险与杀戮。",
        m3_t: "ABYSS天坑", m3_c: "Hypixel系 PvP", m3_d: "跌落深渊，在黑暗与绝望中寻找生机。",
        m4_t: "FML空生自然竞技场", m4_c: "原创职业 PvP", m4_d: "悬浮于虚空之上的竞技擂台，用纯粹的战斗与走位决出真正的胜者。",
        m5_t: "逃走中", m5_c: "对战地图", m5_d: "参考日本节目《全员逃走中》的作品。紧张刺激的隐蔽与追脱玩法，在庞大迷宫中完成任务并躲避猎人追捕。",
        m6_t: "通电2：雪域危机", m6_c: "非对称对战游戏风", m6_d: "深入破败的极地科考站，重启发电机，面对未知的寒冬与硬核逻辑谜题。",
        m7_t: "海岛逃生：黎明前夕", m7_c: "感染/塔防 PvP", m7_d: "具有复杂的建筑结构的遗世孤岛，在绝境中发掘不为人知的惊天秘密。",
        m8_t: "紫晶幻域：救世光源", m8_c: "剧情驱动 RPG", m8_d: "结合宏大沉浸叙事与定制化模型构建史诗级世界观的独立大型作品。",
        view: "查看详情" 
      },
      footer: { title: "准备好<br/>合作了吗？", desc: "若需了解更多详细信息或探讨合作，欢迎随时联络我们。", copy: "© 2019-2026 FIMEL 工作室 · 版权所有" }
    }
  },
  en: {
    translation: {
      nav: { about: "About", works: "Works", contact: "Contact", menu: "Menu" },
      hero: { gen: "GENERATING WORLD...", crafting: "CRAFTING", worlds: "WORLDS", sub: "Restructuring rules through commands, reinventing vanilla through logic.<br/>Dedicated to top-tier Minecraft gameplay development, delivering mind-blowing PVP, RPG, and hardcore puzzle map experiences.", scroll: "Scroll" },
      marq: { pvp: "PvP Arenas", rpg: "RPG Adventures", puz: "Puzzle Maps", vdl: "Voxel Design", jve: "Minecraft Java Edition" },
      about: { tag: "STUDIO MANIFESTO", title: "Breaking limits,<br />Reshaping sandbox.", desc: "Fimel Studio was established in 2019. In China, Minecraft is operated by NetEase, and most of our past works were published there. Unfortunately, we cannot provide public URLs due to platform restrictions, but our works span PvP, PvE, RPG, escaping, and building maps. After phenomenal success there, we are now pushing the boundaries of Java Edition gameplay.", y1: "2019", y1_sub: "Est. Year", y2: "10+", y2_sub: "Masterpieces", render: "RENDER_OBJ: CORE_BLOCK" },
      process: { title: "DIMENSIONS", p1: "VISUALS", p1_sub: "Ground-up Aesthetics", p2: "TERRAIN", p2_sub: "Billion-scale Generations", p3: "LOGIC", p3_sub: "Engine Refactoring", p4: "NARRATIVE", p4_sub: "Immersive Interactions" },
      core: { tag: "CORE EXPERTISE", pvp: "PvP & PvE Combat", pvp_d: "Covers high-speed competitive combat, class balance design, and hardcore PvE survival with landscape exploration.", rpg: "RPG & Escapes", rpg_d: "Crafting massive sandbox worlds, custom model details, immersive narratives, and highly challenging escape rooms.", puz: "Architecture & Logic", puz_d: "Building epic, visually stunning structures from scratch while refactoring engine logic via redstone and advanced datapacks." },
      works: { 
        title: "Selected<br/>Works", inquire: "Inquire For Access", 
        m1_t: "WEREWOLF: F-TOWN", m1_c: "Werewolf PvP", m1_d: "A phenomenal werewolf-style survival map on NetEase Edition.",
        m2_t: "HUNGER GAMES: OLD CITY", m2_c: "Battle Royale PvP", m2_d: "Adrenaline-pumping survival game set in ruined cityscapes.",
        m3_t: "ABYSS", m3_c: "Hypixel-style PvP", m3_d: "Fall into the abyss and seek survival in darkness and despair.",
        m4_t: "FML: SKY NATURE ARENA", m4_c: "Original Class PvP", m4_d: "A combat stage suspended in the void. Rely on pure combat and swordsmanship.",
        m5_t: "RUN FOR MONEY", m5_c: "Competitive Map", m5_d: "A thrilling hide-and-seek experience based on the Japanese show.",
        m6_t: "POWER ON 2: SNOW CRISIS", m6_c: "Asymmetrical PvP", m6_d: "Delve into a ruined polar station, restart the generators to survive.",
        m7_t: "ISLAND ESCAPE: BEFORE DAWN", m7_c: "Infection/Tower PvP", m7_d: "A solitary island with complex structures. Discover hidden secrets.",
        m8_t: "AMETHYST: SALVATION", m8_c: "Story-driven RPG", m8_d: "Our first large-scale RPG project. Combines grand narratives with custom models.",
        view: "View Details" 
      },
      footer: { title: "Ready to<br/>Collaborate?", desc: "If you require more detailed information or wish to discuss a potential collaboration, please feel free to reach out.", copy: "© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED." }
    }
  },
  ja: {
    translation: {
      nav: { about: "我々について", works: "作品", contact: "お問い合わせ", menu: "メニュー" },
      hero: { gen: "世界を生成中...", crafting: "創造", worlds: "無限", sub: "コマンドで法則を再構築し、ロジックでバニラを刷新する。<br/>トップクラスのMinecraftゲームプレイ開発に専念し、常識を覆すPVP、RPG、謎解きのマップ体験を提供します。", scroll: "スクロール" },
      marq: { pvp: "PVP アリーナ", rpg: "RPG アドベンチャー", puz: "謎解きマップ", vdl: "ボクセルデザイン", jve: "Java版 ネイティブ" },
      about: { tag: "マニフェスト", title: "境界を越え、<br />サンドボックスを再定義する", desc: "中国において『Minecraft』はNetEaseが代理運営しており、これまでの多くの作品は中国版Minecraftにて発表してきました。しかしながら、中国版の仕様上、Web上で公開URLを共有することができず、大変申し訳ございません。当スタジオではPvP、PvE、RPG、脱出、建築など様々なジャンルのマップ制作を行っております。詳しい情報が必要であれば喜んでお伝えいたします。", y1: "2019", y1_sub: "設立年", y2: "10+", y2_sub: "総発行作品", render: "コアブロックをレンダリング" },
      process: { title: "次元", p1: "視覚設計", p1_sub: "ゼロからの美学", p2: "地形生成", p2_sub: "何十億ものブロック規模", p3: "機構構築", p3_sub: "システム再構築", p4: "没入体験", p4_sub: "多次元のインタラクション" },
      core: { tag: "専門分野", pvp: "PvP & PvE 戦闘", pvp_d: "極めて高速な判定のスキル対人戦や職業バランス設計、およびハードコアなPvEサバイバルと地形探索。", rpg: "RPG & ストーリー脱出", rpg_d: "壮大な箱庭世界感とカスタムモデルの細部を作り込み、没入感のあるストーリーテリングと高難易度の密室脱出を融合。", puz: "ボクセル建築 & 機構", puz_d: "視覚を圧倒する壮大な建築をゼロから構築し、バニラのレッドストーンと高度なデータパックを組み合わせて既存ロジックを再構築。" },
      works: { 
        title: "これまでの<br/>代表作", inquire: "アクセス申請", 
        m1_t: "狼人殺 F小镇", m1_c: "人狼風 PvP", m1_d: "10万+DL。NetEase版での傑作人狼風サバイバルマップ。",
        m2_t: "饥饿游戏：旧城迷行", m2_c: "サバイバル PvP", m2_d: "5万+DL。廃墟となった旧市街での極限サバイバル。",
        m3_t: "ABYSS天坑", m3_c: "Hypixel系 PvP", m3_d: "1千+DL。深淵に落ち、暗闇の中で生存を探求する傑作。",
        m4_t: "FML空生自然竞技场", m4_c: "オリジナル職業 PvP", m4_d: "1万+DL。虚空に浮かぶ競技場で純粋な戦闘と剣術で勝者を決める。",
        m5_t: "逃走中", m5_c: "対戦マップ", m5_d: "1万+DL。日本の番組を参考にしたスリリングな鬼ごっこ。",
        m6_t: "通電2：雪域危機", m6_c: "非対称対戦ゲーム風", m6_d: "1万+DL。極地基地に潜入し、発電機を再起動する。",
        m7_t: "海岛逃生：黎明前夕", m7_c: "感染/タワー修復 PvP", m7_d: "1万+DL。隔絶された島での絶望と秘密の探索。",
        m8_t: "紫晶幻域：救世光源", m8_c: "ストーリー重視 RPG", m8_d: "1万+DL。壮大な物語とカスタムモデルの初の大規模RPG。",
        view: "詳細を見る" 
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