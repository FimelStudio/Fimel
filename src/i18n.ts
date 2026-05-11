import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  zh: {
    translation: {
      nav: { about: "关于我们", works: "作品阵列", contact: "联络合作", menu: "菜单" },
      hero: { gen: "世界生成中...", crafting: "构筑", worlds: "无限", sub: "重塑方块美学。<br/>基于 Minecraft 引擎，构建极具艺术感与沉浸感的多维交互体验空间。", scroll: "向下滑动" },
      marq: { pvp: "PVP 竞技场", rpg: "RPG 沉浸冒险", puz: "硬核解密", vdl: "体素视觉设计", jve: "Java 原生架构" },
      about: { tag: "工作室宣言", title: "打破传统边界，<br />重塑沙盒交互。", desc: "Fimel 工作室成立于 2019 年。我们曾于网易版缔造多部现象级地图佳作。近年来，团队主攻 Java 原生端，以超越常理的指令逻辑与震撼的体素建筑，在 PVP 竞技、RPG 剧情及硬核解密三大领域不断刷新玩家认知。", y1: "2019", y1_sub: "创立年份", y2: "10+", y2_sub: "总发行佳作", render: "核心方块载入完毕" },
      process: { title: "构筑维度", p1: "视觉设计", p1_sub: "从零开始的美学构筑", p2: "原生地形", p2_sub: "亿万级方块尺度演算", p3: "机制编程", p3_sub: "底层引擎逻辑重构", p4: "交互叙事", p4_sub: "多维沉浸感知设计" },
      core: { tag: "核心领域", pvp: "PVP 战斗构建", pvp_d: "毫秒级判定的战斗系统与职业平衡设计，结合地貌结构打造极致的肾上腺素飙升竞技擂台。", rpg: "RPG 史诗构筑", rpg_d: "庞大的箱庭世界观、错综复杂的技能树与定制模型交互，带来主机级动作冒险剧情演绎。", puz: "硬核逻辑解密", puz_d: "跳出三维空间的视觉与思维欺骗，结合原生红石与高阶指令数据包的三维空间解谜系统。" },
      works: { title: "入选<br/>作品", inquire: "获取游玩授权", map1: "PVP 擂台", map2: "RPG 冒险大作", map3: "微距解密", desc: "探索这座地图的深层设定与指令架构。打破实体模型限制，通过数据包与资源包的极致融合，重新定义沙盒游玩体验。", view: "查看详情" },
      footer: { title: "准备好<br/>创造了吗？", desc: "无论是架构一场史诗级的 RPG 战役，<br />还是打造您的专属服务器地图生态，随时联络我们。", copy: "© 2019-2026 FIMEL 工作室 · 版权所有" }
    }
  },
  en: {
    translation: {
      nav: { about: "About", works: "Works", contact: "Contact", menu: "Menu" },
      hero: { gen: "GENERATING WORLD...", crafting: "CRAFTING", worlds: "WORLDS", sub: "Reshaping Voxel Aesthetics.<br/>Building artistic and immersive multi-dimensional experiences based on Minecraft.", scroll: "Scroll" },
      marq: { pvp: "PvP Arenas", rpg: "RPG Adventures", puz: "Puzzle Maps", vdl: "Voxel Design", jve: "Minecraft Java Edition" },
      about: { tag: "STUDIO MANIFESTO", title: "Breaking limits,<br />Reshaping sandbox.", desc: "Fimel Studio was established in 2019. After creating phenomenal maps on Netease, we now focus on Java Edition, pushing boundaries in PVP, RPG, and hardcore puzzle maps with exceptional commands and voxel logic.", y1: "2019", y1_sub: "Est. Year", y2: "10+", y2_sub: "Masterpieces", render: "RENDER_OBJ: CORE_BLOCK" },
      process: { title: "DIMENSIONS", p1: "VISUALS", p1_sub: "Ground-up Aesthetics", p2: "TERRAIN", p2_sub: "Billion-scale Generations", p3: "LOGIC", p3_sub: "Engine Refactoring", p4: "NARRATIVE", p4_sub: "Immersive Interactions" },
      core: { tag: "CORE EXPERTISE", pvp: "PVP Arenas", pvp_d: "Millisecond combat and class balance design for extreme adrenaline-pumping arenas.", rpg: "RPG Epics", rpg_d: "Massive sandbox worlds, custom model interactions, and complex skill trees.", puz: "Logic Puzzles", puz_d: "Breaking 3D visual illusions with advanced spatial puzzle systems and datapacks." },
      works: { title: "Selected<br/>Works", inquire: "Inquire For Access", map1: "PVP Arena Map", map2: "RPG Adventure", map3: "Puzzle / Logic", desc: "Explore the internal structure and command architecture. Breaking limits of entity models, redefining sandbox gameplay.", view: "View Details" },
      footer: { title: "Ready to<br/>Craft?", desc: "Whether building an epic RPG campaign,<br />or forging your server ecosystem, contact us.", copy: "© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED." }
    }
  },
  ja: {
    translation: {
      nav: { about: "我々について", works: "作品", contact: "お問い合わせ", menu: "メニュー" },
      hero: { gen: "世界を生成中...", crafting: "創造", worlds: "無限", sub: "ボクセル美学の再構築。<br/>Minecraftエンジンによる芸術的で没入感のある多次元体験を。", scroll: "スクロール" },
      marq: { pvp: "PVP アリーナ", rpg: "RPG アドベンチャー", puz: "謎解きマップ", vdl: "ボクセルデザイン", jve: "Java版 ネイティブ" },
      about: { tag: "マニフェスト", title: "境界を越え、<br />サンドボックスを再定義する", desc: "Fimel Studioは2019年に設立されました。網易版での名作を経て、現在はJava版に注力。革新的なコマンドと建築によりPVP、RPG、謎解きの分野で限界に挑戦しています。", y1: "2019", y1_sub: "設立年", y2: "10+", y2_sub: "総発行作品", render: "コアブロックをレンダリング" },
      process: { title: "次元", p1: "視覚設計", p1_sub: "ゼロからの美学", p2: "地形生成", p2_sub: "何十億ものブロック規模", p3: "機構構築", p3_sub: "システム再構築", p4: "没入体験", p4_sub: "多次元のインタラクション" },
      core: { tag: "専門分野", pvp: "PVP アリーナ", pvp_d: "ミリ秒単位の戦闘システムと職業バランスで究極のアドレナリン体験を。", rpg: "RPG エピック", rpg_d: "壮大な箱庭の世界観、複雑なスキルツリー、カスタムモデルによる冒険。", puz: "論理謎解き", puz_d: "レッドストーンと高度なデータパックを活用した三次元空間の謎解きシステム。" },
      works: { title: "選ばれた<br/>作品", inquire: "アクセス申請", map1: "PVP アリーナ", map2: "RPG アドベンチャー", map3: "論理パズル", desc: "マップの深層設定とコマンド構造を探索する。エンティティの制限を打ち破り、新しいゲーム体験を定義します。", view: "詳細を見る" },
      footer: { title: "創造の<br/>準備は？", desc: "壮大なRPGキャンペーンの構築から、<br />専属サーバーのマップ開発まで、お問い合わせください。", copy: "© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED." }
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