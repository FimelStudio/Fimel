import type { Project } from './projects';

// Editorial selection only. All display data stays in works/catalogue.json.
// Maps remain the primary showcase; released software and work in progress
// have separate groups so an unfinished project cannot look downloadable.
export const HOME_FEATURED = {
  maps: ['island-escape-before-dawn', 'amethyst-salvation', 'es-atrium-showdown'],
  released: ['minecraft-explorer', 'minecraft-obj-cubizer', 'bingo-but-dont-do-it'],
  development: ['fimel-card', 'spoiler-rpg', 'island-escape-java'],
} as const;

export type FeaturedGroup = keyof typeof HOME_FEATURED;

// Shared by the homepage and Admin; publication visibility is checked separately.
export function matchesFeaturedGroup(project: Pick<Project, 'type' | 'status'>, group: FeaturedGroup): boolean {
  if (group === 'maps') return project.type === 'bedrock' && project.status === 'released';
  return group === 'released' ? project.status === 'released' : project.status !== 'released';
}
