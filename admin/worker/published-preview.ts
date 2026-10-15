import type { Work } from '../shared/model';
import { ApiError, json } from './http';
import { libraryState, publicState } from './storage';
export async function publishedPreview(id: string, priv: R2Bucket, pub: R2Bucket) {
  const library = await libraryState(priv); const work = library.value.works.find(w => w.id === id);
  if (!work) throw new ApiError(404, '作品不存在。');
  const manifest = await publicState(pub); const project = manifest.value.projects.find(p => p.slug === work.project.slug);
  if (!project) return json({ project: null, markdown: null, releases: [] });
  const markdown: Work['markdown'] = { description: {}, changelog: {}, versions: {} }; const unavailable: string[] = [];
  for (const tab of ['description', 'changelog', 'versions'] as const) {
    const value = project.content[tab]; const localized = typeof value === 'string' ? { zh: value } : value ?? {};
    for (const [locale, url] of Object.entries(localized)) {
      const location = new URL(url, 'https://studiofimel.com/');
      if (location.origin !== 'https://download.studiofimel.com' || !location.pathname.startsWith(`/content/${project.slug}/`)) { unavailable.push(`${tab}.${locale}`); continue; }
      const object = await pub.get(location.pathname.slice(1));
      if (!object || object.size > 800_000) { unavailable.push(`${tab}.${locale}`); continue; }
      markdown[tab][locale as 'zh' | 'en' | 'ja'] = await object.text();
    }
  }
  return json({ project, markdown, releases: manifest.value.releases[project.slug] ?? [], unavailable });
}
