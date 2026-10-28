import type { TFunction } from 'i18next';
import type { HomeSpotlight } from './site-content';
import type { Project } from './projects';
import { localizedText, projectCopy } from './projects';

export const SPOTLIGHT_KEYS = ['maps', 'mods', 'tools'] as const;
export type SpotlightKey = typeof SPOTLIGHT_KEYS[number];
const defaults = {
  maps: { slug: 'island-escape-before-dawn', path: '/works?type=bedrock', image: 'assets/images/works/island-escape-before-dawn/cover.png' },
  mods: { slug: 'bingo-but-dont-do-it', path: '/works?type=mods', image: 'assets/images/works/bingo-but-dont-do-it/cover.png' },
  tools: { slug: 'minecraft-obj-cubizer', path: '/works?type=tools', image: 'assets/images/works/minecraft-obj-cubizer/cover.svg' },
};

export function spotlightCopy(key: SpotlightKey, config: HomeSpotlight | undefined, projects: Project[], t: TFunction, language: string) {
  const selected = config?.workSlug ? projects.find(project => project.slug === config.workSlug) : undefined;
  const project = selected ?? projects.find(project => project.slug === defaults[key].slug);
  const copy = selected ? projectCopy(selected, t, language) : undefined;
  return {
    label: localizedText(config?.label, language) || (selected ? t(`catalogue.types.${selected.type}`) : t(`home.${key}_title`)),
    title: localizedText(config?.title, language) || copy?.title || t(`home.${key}_featured`),
    summary: localizedText(config?.summary, language) || copy?.summary || t(`home.${key}_desc`),
    href: selected ? `/works/${selected.slug}` : defaults[key].path,
    image: project?.featuredImage || project?.image || defaults[key].image,
    project,
  };
}
