// Editorial selection only. All display data stays in works/catalogue.json.
// Maps remain the primary showcase; released software and work in progress
// have separate groups so an unfinished project cannot look downloadable.
export const HOME_FEATURED = {
  maps: ['island-escape-before-dawn', 'amethyst-salvation', 'es-atrium-showdown'],
  released: ['minecraft-explorer', 'minecraft-obj-cubizer', 'bingo-but-dont-do-it'],
  development: ['fimel-card', 'spoiler-rpg', 'island-escape-java'],
} as const;
