import { PUBLIC_ORIGIN } from '../shared/model';
import type { Asset, PublicManifest, PublicRelease, Work } from '../shared/model';
import type { Project, ProjectTab, LocalizedText } from '../../src/content/projects';
import { localizedText } from '../../src/content/projects';
import { ApiError, putJson } from './http';
import { backup, MANIFEST_KEY } from './storage';

export async function publishedWork(work: Work, privateBucket: R2Bucket, publicBucket: R2Bucket, publicationId: string) {
  if (work.workflow === 'archived') throw new ApiError(422, '归档作品须先恢复为草稿。');
  if(!Object.values(work.markdown.description).some(value=>value?.trim()))throw new ApiError(422,'发布前至少填写一种语言的作品详情。');
  const project: Project = structuredClone(work.project);
  const releaseAssets = work.versions.filter(v => v.status === 'released').flatMap(v => v.files);
  const publicAssets = new Map<string, string>();
  for (const asset of [...work.gallery, ...releaseAssets]) {
    const release = work.versions.find(v => v.files.some(f => f.id === asset.id));
    const kind = release ? 'works' : 'images';
    const version = release ? `${release.label}-${asset.id}` : asset.id;
    const key = `${kind}/${project.type}/${project.slug}/${version}/${asset.name}`;
    publicAssets.set(asset.id, await publishAsset(work, asset, privateBucket, publicBucket, key, release?.id));
  }
  if (work.coverId) project.image = publicAssets.get(work.coverId)!;
  const content: Project['content'] = {};
  for (const tab of ['description', 'changelog', 'versions'] as ProjectTab[]) {
    const paths: Record<string, string> = {};
    for (const [locale, markdown] of Object.entries(work.markdown[tab])) {
      let body = markdown;
      for (const [id, url] of publicAssets) body = body.replaceAll(`fimel-asset:${id}`, url);
      if (/fimel-asset:/.test(body)) throw new ApiError(422, '正文引用了未发布资源。');
      if (tab === 'versions') {
        for (const release of work.versions.filter(v => v.status === 'released')) {
          body += `\n\n## ${release.label} · ${release.date}\n\n${release.gameVersions.join(' / ')}\n\n${localizedText(release.changelog,locale)}\n\n`;
          for (const file of release.files) body += `- [${markdownName(file)}](${publicAssets.get(file.id)}) · ${(file.size/1024**2).toFixed(1)} MiB\n  - SHA-256: \`${file.sha256}\`\n`;
        }
      }
      if (tab === 'description' && work.gallery.length) body += '\n\n' + work.gallery.map(a => `![${markdownName(a)}](${publicAssets.get(a.id)})`).join('\n');
      const key = `content/${project.slug}/${publicationId}/${tab}.${locale}.md`;
      const saved = await publicBucket.put(key, body, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'text/markdown; charset=utf-8', cacheControl: 'public, max-age=31536000, immutable' } });
      if (!saved) throw new ApiError(409, '正文快照已存在。');
      paths[locale] = `${PUBLIC_ORIGIN}/${key}`;
    }
    if (!Object.keys(paths).length) throw new ApiError(422, `${tab} 至少需要一种语言正文。`);
    content[tab] = paths as LocalizedText;
  }
  project.content = content;
  const releases: PublicRelease[] = work.versions.filter(v => v.status === 'released').map(v => ({ ...v,
    files: v.files.map(a => ({ id: a.id, name: a.name, ...(a.displayName?{displayName:a.displayName}:{}), size: a.size, mime: a.mime, sha256: a.sha256, ...(a.primary ? { primary: true } : {}), publicUrl: publicAssets.get(a.id)! })),
  }));
  const latest = releases[0]; const primary = latest?.files.find(f => f.primary) ?? latest?.files[0];
  if (primary) { project.downloadUrl = primary.publicUrl; project.version = latest.label; project.size = `${(primary.size / 1024 ** 2).toFixed(1)} MiB`; }
  if (project.downloadUrl) {
    const key = new URL(project.downloadUrl).pathname.slice(1);
    if (!await publicBucket.head(key)) throw new ApiError(422, '主下载对象不存在，不能发布。');
    project.downloadSlug ??= project.slug;
  }
  return { project, releases };
}
async function publishAsset(work: Work, asset: Asset, priv: R2Bucket, pub: R2Bucket, key: string, versionId?: string) {
  if (!asset.privateKey) {
    if (!asset.publicUrl || !await pub.head(new URL(asset.publicUrl).pathname.slice(1))) throw new ApiError(422, '已发布资源不存在。');
    return asset.publicUrl;
  }
  const source = await priv.get(asset.privateKey);
  if (!source || source.size !== asset.size || !source.customMetadata || source.customMetadata.workId !== work.id ||
    source.customMetadata.assetId !== asset.id || source.customMetadata.sha256 !== asset.sha256 ||
    source.customMetadata.versionId !== (versionId ?? '') || source.httpMetadata?.contentType !== asset.mime) throw new ApiError(422, '资源未完成验证或不属于此作品/版本。');
  const existing = await pub.head(key);
  if (existing) {
    if (existing.customMetadata?.sha256 !== asset.sha256 || existing.size !== asset.size) throw new ApiError(409, '目标文件存在，禁止覆盖。');
  } else {
    const result = await pub.put(key, source.body, { sha256: asset.sha256, onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: asset.mime, cacheControl: 'public, max-age=31536000, immutable', ...(versionId ? { contentDisposition: `attachment; filename="${asset.name}"; filename*=UTF-8''${encodeURIComponent(asset.displayName??asset.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}` } : {}) },
      customMetadata: { sha256: asset.sha256, assetId: asset.id } });
    if (!result) throw new ApiError(409, '目标文件已存在，未覆盖。');
  }
  return `${PUBLIC_ORIGIN}/${key}`;
}
export async function commitPublication(priv: R2Bucket, pub: R2Bucket, before: PublicManifest, after: PublicManifest, etag: string) {
  await backup(priv, before, 'public');
  await putJson(priv, `snapshots/${after.publicationId}.json`, after);
  await putJson(pub, `data/snapshots/${after.publicationId}.json`, after);
  // Last write is the public manifest; failed CAS leaves only unreachable immutable snapshots.
  return putJson(pub, MANIFEST_KEY, after, etag);
}
function markdownName(asset:Asset){return (asset.displayName??asset.name).replace(/[\\[\]()]/g,'\\$&');}
