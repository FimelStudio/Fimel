import type { Project, LocalizedText } from './projects';

export type DownloadFile = { id: string; name: string; displayName?: string; size: number; sha256: string; mime: string; publicUrl: string; primary?: boolean };
export type DownloadRelease = { id: string; label: string; date: string; gameVersions: string[]; loaders?: string[]; platforms?: string[]; status: 'released'; changelog?:LocalizedText; files: DownloadFile[] };

export function earliestReleaseDate(releases: readonly { status: string; date: string; files: readonly unknown[] }[]): string | undefined {
  return releases.filter(release => {
    if (release.status !== 'released' || !release.files.length || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(release.date)) return false;
    const timestamp = Date.parse(`${release.date}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === release.date;
  }).map(release => release.date).sort()[0];
}

/** Shared by the page, Admin preview and publisher. Browsing never advances dates. */
export function releaseProject(project:Project,releases:DownloadRelease[],publicationDate?:string):Project {
  const latest=releases.find(r=>r.files.length);const primary=latest?.files.find(f=>f.primary)??latest?.files[0];
  const updated=[project.updated,...releases.map(r=>r.date),publicationDate].filter((date):date is string=>!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1);
  const published=project.published??(project.status==='released'?earliestReleaseDate(releases):undefined);
  return {...project,...(published?{published}:{}),...(updated?{updated}:{}),...(latest&&primary?{version:latest.label,size:fileSize(primary.size),downloadUrl:primary.publicUrl,...(latest.platforms?.length?{platform:latest.platforms}:{})}:{})};
}
export function parseReleases(value: unknown, projects: Project[]): Record<string, DownloadRelease[]> {
  if (!value || typeof value !== 'object' || !('releases' in value)) return {};
  const records = value.releases;
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw Error('Invalid releases.');
  const output: Record<string, DownloadRelease[]> = {};
  for (const project of projects) {
    const versions = Object.hasOwn(records,project.slug)?(records as Record<string, unknown>)[project.slug]:undefined;
    if (versions === undefined) continue;
    if (!Array.isArray(versions) || versions.length > 100) throw Error('Invalid release list.');
    const strings = (a: unknown): a is string[] => Array.isArray(a) && a.length <= 30 && a.every(x => typeof x === 'string' && x.length <= 80);
    const ids = new Set<string>();
    for (const r of versions) {
      if (!r || typeof r.id !== 'string' || ids.has(r.id) || typeof r.label !== 'string' || !r.label.trim() || r.status !== 'released' ||
        typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !strings(r.gameVersions) ||
        r.loaders !== undefined && !strings(r.loaders) || r.platforms !== undefined && !strings(r.platforms) || !Array.isArray(r.files) || r.files.length > 30) throw Error('Invalid release.');
      ids.add(r.id);
      if(r.changelog!==undefined){const text=(v:unknown)=>typeof v==='string'&&v.length<=200_000;if(!text(r.changelog)&&(!r.changelog||typeof r.changelog!=='object'||Array.isArray(r.changelog)||Object.entries(r.changelog).some(([k,v])=>!['zh','en','ja'].includes(k)||!text(v))))throw Error('Invalid release notes.');}
      const fileIds = new Set<string>();
      for (const f of r.files) {
        if (!f || typeof f.id !== 'string' || fileIds.has(f.id) || typeof f.name !== 'string' || !f.name || f.displayName !== undefined && typeof f.displayName !== 'string' ||
          !Number.isSafeInteger(f.size) || f.size < 1 || typeof f.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(f.sha256) || typeof f.mime !== 'string' ||
          typeof f.publicUrl !== 'string' || 'privateKey' in f) throw Error('Invalid release file.');
        const url = new URL(f.publicUrl);
        if (url.origin !== 'https://download.studiofimel.com' || url.username || url.password || url.search || url.hash ||
          !url.pathname.startsWith(`/works/${project.type}/${project.slug}/`)) throw Error('Invalid release download URL.');
        fileIds.add(f.id);
      }
    }
    output[project.slug] = versions;
  }
  return output;
}

export function fileSize(size: number) {
  return size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(2)} GiB` : size >= 1024 ** 2 ? `${(size / 1024 ** 2).toFixed(1)} MiB` : `${Math.ceil(size / 1024)} KiB`;
}
