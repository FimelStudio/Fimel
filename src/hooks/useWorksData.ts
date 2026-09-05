import { useTranslation } from 'react-i18next';

export type BedrockEntry = {
  i18nKey: string;
  downloads: string;
  rating: string;
  comments: string;
  remarks: string;
  size: string;
  version: string;
  released: string;
  updated: string;
  image: string;
  link: string;
  accent: string;
  bg: string;
};

export const FEATURED_MAPS: BedrockEntry[] = [
  {
    i18nKey: "werewolfFTown",
    downloads: "427,397",
    rating: "3.9",
    comments: "78",
    remarks: "176",
    size: "183 KB",
    version: "v1.23",
    released: "2021-07-12",
    updated: "2021-07-12",
    image: "maps/werewolf-f-town.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4648588173337957318",
    accent: "group-hover:text-red-500 dark:group-hover:text-red-400",
    bg: "from-red-500/10"
  },
  {
    i18nKey: "hungerGamesOldCity",
    downloads: "84,098",
    rating: "4.3",
    comments: "51",
    remarks: "95",
    size: "11.7 MB",
    version: "v2.2",
    released: "2022-08-09",
    updated: "2022-08-28",
    image: "maps/hunger-games-old-city.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4657291854883079467",
    accent: "group-hover:text-amber-500",
    bg: "from-amber-500/10"
  },
  {
    i18nKey: "abyssSkyPit",
    downloads: "1,990",
    rating: "4.3",
    comments: "10",
    remarks: "16",
    size: "3.8 MB",
    version: "v1.23",
    released: "2021-09-03",
    updated: "2021-09-03",
    image: "maps/abyss-sky-pit.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4649770038789663060",
    accent: "group-hover:text-green-500",
    bg: "from-green-500/10"
  },
  {
    i18nKey: "fmlSkyNatureArena",
    downloads: "33,251",
    rating: "4.7",
    comments: "27",
    remarks: "41",
    size: "1.1 MB",
    version: "v1.21",
    released: "2021-04-02",
    updated: "2021-07-14",
    image: "maps/fml-sky-nature-arena.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4646359448597896554",
    accent: "group-hover:text-blue-500",
    bg: "from-blue-500/10"
  },
  {
    i18nKey: "runForMoney",
    downloads: "17,809",
    rating: "4.2",
    comments: "29",
    remarks: "40",
    size: "564 KB",
    version: "v2.0",
    released: "2022-01-28",
    updated: "2022-01-30",
    image: "maps/run-for-money.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4653059746050819814",
    accent: "group-hover:text-rose-500",
    bg: "from-rose-500/10"
  },
  {
    i18nKey: "powerOn2SnowCrisis",
    downloads: "22,286",
    rating: "5.0",
    comments: "16",
    remarks: "63",
    size: "6.8 MB",
    version: "v2.1",
    released: "2022-06-02",
    updated: "2022-06-02",
    image: "maps/power-on-2-snow-crisis.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4655644384723477429",
    accent: "group-hover:text-cyan-500",
    bg: "from-cyan-500/10"
  },
  {
    i18nKey: "islandEscapeBeforeDawn",
    downloads: "39,520",
    rating: "4.2",
    comments: "15",
    remarks: "39",
    size: "18.3 MB",
    version: "v3.2",
    released: "2025-02-16",
    updated: "2025-02-16",
    image: "maps/island-escape-before-dawn.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4677793220493990518",
    accent: "group-hover:text-emerald-500",
    bg: "from-emerald-500/10"
  },
  {
    i18nKey: "amethystSalvation",
    downloads: "13,523",
    rating: "4.7",
    comments: "90",
    remarks: "192",
    size: "3.7 MB",
    version: "v2.11",
    released: "2024-07-01",
    updated: "2024-09-20",
    image: "maps/amethyst-salvation.png",
    link: "https://resource-minecraft.h5.163.com/#/detail?id=4672593901126936215",
    accent: "group-hover:text-amethyst",
    bg: "from-amethyst/10"
  }
];

export type ProjectEntry = {
  title: string;
  subtitle: string;
  category: string;
  status: string;
  desc: string;
  texture: string;
  accent: string;
  tags: string[];
  image?: string;
  download?: string;
  downloadSlug?: string;
  repo?: string;
  version?: string;
  author?: string;
  fileLabel?: string;
};

export type SiteMetaType = {
  bingoCategory: string;
  bingoSubtitle: string;
  bingoDescription: string;
  bingoTags: string[];
  contactLabels: string[];
  studio: {
    originTitle: string;
    originBody: string;
    milestones: { year: string; title: string; desc: string; }[];
    principles: { number: string; title: string; desc: string; }[];
  };
};

export function useWorksData() {
  const { t } = useTranslation();
  
  const siteMeta = t('siteMeta', { returnObjects: true }) as SiteMetaType;
  const basePath = import.meta.env.BASE_URL;

  const bedrockEntries = FEATURED_MAPS.map((work) => {
    const components = t(`works.bedrockMaps.${work.i18nKey}.components`, { returnObjects: true }) as string[];
    return {
      ...work,
      title: t(`works.bedrockMaps.${work.i18nKey}.title`) as string,
      subtitle: t(`works.bedrockMaps.${work.i18nKey}.subtitle`) as string,
      category: t(`works.bedrockMaps.${work.i18nKey}.category`) as string,
      genre: t(`works.bedrockMaps.${work.i18nKey}.genre`) as string,
      desc: t(`works.bedrockMaps.${work.i18nKey}.desc`) as string,
      players: t(`works.bedrockMaps.${work.i18nKey}.players`) as string,
      components
    };
  });

  const objCubizerDownload = `${basePath}plugins/minecraft-obj-cubizer/minecraft_obj_cubizer-1.4.0.zip`;
  const objCubizerLogo = `${basePath}plugins/minecraft-obj-cubizer/minecraft-obj-cubizer-logo.svg`;
  const objCubizerRepo = 'https://github.com/Ylong4004/minecraft_obj_cubizer';
  const bingoLogo = `${basePath}bingo-but-dont-do-it-logo.png`;

  const javaEntries: ProjectEntry[] = [
    {
      title: t('works.m9_t'),
      subtitle: 'Island Escape: Java Core',
      category: t('works.m9_c'),
      status: t('workPages.status.prototype'),
      desc: t('works.m9_d'),
      texture: 'ice.png',
      accent: 'group-hover:text-[#ff9ff3]',
      tags: t('workPages.java.project1_tags', { returnObjects: true }) as string[]
    },
    {
      title: t('works.m10_t'),
      subtitle: 'Narrative RPG',
      category: t('works.m10_c'),
      status: t('workPages.status.design'),
      desc: t('works.m10_d'),
      texture: 'amethyst',
      accent: 'group-hover:text-diamond',
      tags: t('workPages.java.project2_tags', { returnObjects: true }) as string[]
    }
  ];

  const modsEntries: ProjectEntry[] = [
    {
      title: 'Bingo × Don\'t Do It',
      subtitle: siteMeta.bingoSubtitle,
      category: siteMeta.bingoCategory,
      status: t('workPages.status.live'),
      desc: siteMeta.bingoDescription,
      texture: 'redstone_block.png',
      image: bingoLogo,
      accent: 'group-hover:text-emerald-500',
      tags: siteMeta.bingoTags,
      repo: 'https://github.com/Ylong4004/bingo-but-dont-do-it'
    }
  ];

  const toolsEntries: ProjectEntry[] = [
    {
      title: t('workPages.tools.objCubizer.title'),
      subtitle: t('workPages.tools.objCubizer.subtitle'),
      category: t('workPages.tools.objCubizer.category'),
      status: t('workPages.tools.objCubizer.status'),
      desc: t('workPages.tools.objCubizer.desc'),
      texture: 'diamond_block.png',
      image: objCubizerLogo,
      download: objCubizerDownload,
      downloadSlug: 'minecraft-obj-cubizer',
      repo: objCubizerRepo,
      version: 'v1.4.0',
      author: 'Ylong',
      fileLabel: 'ZIP · 52.5 KB',
      accent: 'group-hover:text-diamond',
      tags: t('workPages.tools.objCubizer.tags', { returnObjects: true }) as string[]
    },
    {
      title: t('works.tool1_t'),
      subtitle: 'Production Toolchain',
      category: t('works.tool1_c'),
      status: t('workPages.status.wip'),
      desc: t('works.tool1_d'),
      texture: 'iron_block.png',
      accent: 'group-hover:text-blue-500',
      tags: t('workPages.tools.tags', { returnObjects: true }) as string[]
    }
  ];

  return {
    siteMeta,
    bedrockEntries,
    javaEntries,
    modsEntries,
    toolsEntries,
  };
}
