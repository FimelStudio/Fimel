import type { R2Bucket } from '@cloudflare/workers-types';
import { parseCatalogue, localizedText, PROJECT_TABS } from '../content/projects';
import type { Project, ProjectTab } from '../content/projects';
import { fileSize, parseReleases, releaseProject } from '../content/releases';
import type { DownloadRelease } from '../content/releases';
import { DOCS_MANIFEST_KEY, DOCS_MAX_BYTES, docsLocalizedText, parseDocsManifest } from '../content/docs';
import { parseSiteContent } from '../content/site-content';
import { DOWNLOAD_ORIGIN, PUBLIC_ORIGIN, escapeHtml as e, publicMarkdown, publicUrl } from './public-markdown';
import { unsafeUrlCharacters } from './public-routing';

type PageAssets = { fetch(request: Request): Promise<Response> };
type PageEnvironment = { PUBLIC?: R2Bucket; ASSETS: PageAssets };
type Page = { title: string; summary: string; body: string; image?: string };
const labels = {
  zh: { home: '首页', works: '作品', docs: '文档', studio: '关于我们', versions: '版本与下载', description: '概述', changelog: '更新日志', download: '下载文件', repository: '项目仓库', platform: '发布平台', published: '首次发布', updated: '上次更新', missing: '内容不存在或已下架', unavailable: '已发布内容暂时无法读取，请稍后重试。', empty: '暂无已发布内容' },
  en: { home: 'Home', works: 'Projects', docs: 'Documentation', studio: 'Studio', versions: 'Versions and downloads', description: 'Overview', changelog: 'Changelog', download: 'Download file', repository: 'Repository', platform: 'Publication platform', published: 'First published', updated: 'Last updated', missing: 'Content not found or removed', unavailable: 'Published content is temporarily unavailable. Please retry shortly.', empty: 'No published content yet' },
  ja: { home: 'ホーム', works: '作品', docs: 'ドキュメント', studio: 'スタジオ', versions: 'バージョン・ダウンロード', description: '概要', changelog: '変更履歴', download: 'ダウンロード', repository: 'リポジトリ', platform: '公開プラットフォーム', published: '初回公開', updated: '最終更新', missing: 'コンテンツが見つからないか、公開が取り消されています', unavailable: '公開コンテンツを取得できません。しばらくしてから再試行してください。', empty: '公開コンテンツはまだありません' },
};
type Locale = keyof typeof labels;
const MAX_MARKDOWN = 1024 * 1024;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPublicPage(path: string) {
  // These are existing public resources, not application page routes.
  if (path === '/works/catalogue.json' || /^\/works\/.+\.md$/.test(path)) return false;
  return path === '/' || path === '/index.html' || path === '/robots.txt' || path === '/sitemap.xml' || /^\/(?:works|docs)(?:\/|$)/.test(path);
}

async function objectText(bucket: R2Bucket | undefined, key: string, maximum: number) {
  if (!bucket) throw Error('Public binding unavailable');
  const object = await bucket.get(key);
  if (!object) throw Error('Published object unavailable');
  if (object.size > maximum) { await object.body.cancel(); throw Error('Published object too large'); }
  return object.text();
}

async function boundedAsset(response: Response, maximum: number) {
  if (!response.ok || !response.body) throw Error('Static content unavailable');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw Error('Static content too large'); }
      parts.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function workData(env: PageEnvironment) {
  const value: unknown = JSON.parse(await objectText(env.PUBLIC, 'data/works.json', 4 * 1024 * 1024));
  const projects = parseCatalogue(value);
  if (projects.length > 1000) throw Error('Catalogue too large');
  return { projects, releases: parseReleases(value, projects), site: parseSiteContent(value) };
}
async function docsData(env: PageEnvironment) {
  return parseDocsManifest(JSON.parse(await objectText(env.PUBLIC, DOCS_MANIFEST_KEY, DOCS_MAX_BYTES)));
}

/** Only the published content bucket and bundled Markdown are readable. No external fetch. */
async function workMarkdown(path: string, env: PageEnvironment, pageUrl: string) {
  const source = new URL(path, PUBLIC_ORIGIN + '/');
  const decoded = decodeURIComponent(source.pathname);
  if (source.username || source.password || source.search || source.hash || unsafeUrlCharacters(decoded) || decoded.includes('%') || decoded.split('/').includes('..')) throw Error('Invalid Markdown source');
  let text: string;
  if (source.origin === DOWNLOAD_ORIGIN && /^\/content\/.+\.md$/.test(decoded)) {
    text = await objectText(env.PUBLIC, decoded.slice(1), MAX_MARKDOWN);
  } else if (source.origin === PUBLIC_ORIGIN && /^\/works\/.+\.md$/.test(decoded)) {
    const response = await env.ASSETS.fetch(new Request(source.href, { signal: AbortSignal.timeout(10_000) }));
    if (/text\/html/i.test(response.headers.get('Content-Type') ?? '')) throw Error('Markdown returned SPA');
    text = await boundedAsset(response, MAX_MARKDOWN);
  } else throw Error('Unsupported Markdown source');
  if (/^\s*(?:<!doctype html|<html\b)/i.test(text)) throw Error('Markdown returned HTML');
  return publicMarkdown(text, source.href, pageUrl);
}

function link(url: string | undefined, text: string, base?: string) {
  const safe = publicUrl(url, base);
  return safe ? `<a href="${e(safe)}">${e(text)}</a>` : '';
}
function pathFor(path: string, locale: Locale, params?: Record<string, string>) {
  const query = new URLSearchParams(params);
  if (locale !== 'zh') query.set('lang', locale);
  return path + (query.size ? '?' + query.toString() : '');
}
function projectList(projects: Project[], locale: Locale) {
  if (!projects.length) return `<p>${e(labels[locale].empty)}</p>`;
  return `<ul class="public-list">${projects.map(project => `<li><h2>${link(pathFor('/works/' + project.slug, locale), localizedText(project.title, locale))}</h2><p>${e(localizedText(project.summary, locale))}</p><p>${e(project.platform.join(' · '))}</p></li>`).join('')}</ul>`;
}
function releasesHtml(project: Project, versions: DownloadRelease[], locale: Locale) {
  const text = labels[locale];
  if (!versions.length) return `<p>${link(project.downloadUrl || project.download || project.releasePage || project.store || project.fallbackDownload || (project.latestReleaseRepo ? `https://github.com/${project.latestReleaseRepo}/releases` : undefined), text.platform) || e(text.empty)}</p>`;
  return versions.map(version => `<section><h2>${e(version.label)}</h2><p><time datetime="${e(version.date)}">${e(version.date)}</time> · ${e([...version.gameVersions, ...(version.loaders ?? []), ...(version.platforms ?? [])].join(' · '))}</p><ul>${version.files.map(file => `<li>${link(file.publicUrl, `${text.download}: ${file.displayName || file.name}`)} · ${e(fileSize(file.size))}<details><summary>SHA-256</summary><code>${e(file.sha256)}</code></details></li>`).join('')}</ul>${version.changelog ? publicMarkdown(localizedText(version.changelog, locale), PUBLIC_ORIGIN + '/') : ''}</section>`).join('');
}
function nav(locale: Locale) {
  const text = labels[locale];
  return `<nav aria-label="Fimel Studio"><a href="/">Fimel Studio</a>${(['home', 'works', 'docs', 'studio'] as const).map(key => link(pathFor(key === 'home' ? '/' : '/' + key, locale), text[key])).join('')}</nav>`;
}

const fallbackStyle = `<style id="public-reader-style">
.public-reader{max-width:1040px;margin:auto;padding:32px 24px 80px;line-height:1.8;overflow-wrap:anywhere;font-family:system-ui,sans-serif;color:#1f2328}.dark .public-reader{color:#e6edf3}.public-reader nav{display:flex;flex-wrap:wrap;gap:24px;border-bottom:1px solid #818b9855;padding:12px 0 24px;margin-bottom:32px}.public-reader a{color:#007780;text-decoration:underline}.dark .public-reader a{color:#66e5dd}.public-reader h1{font-size:2rem;font-weight:700;margin:24px 0}.public-reader h2{font-size:1.5rem;font-weight:650;margin:24px 0 12px}.public-reader h3{font-size:1.2rem;font-weight:650;margin:20px 0 10px}.public-reader p{margin:12px 0}.public-reader ul,.public-reader ol{padding-left:24px;list-style:revert}.public-reader img{display:inline-block;max-width:100%;height:auto;object-fit:contain}.public-reader .public-cover{display:block;max-height:320px;margin:24px auto}.public-reader table{border-collapse:collapse;display:block;overflow-x:auto;width:100%;margin:24px 0}.public-reader th,.public-reader td{border:1px solid #818b9855;padding:12px}.public-reader table img{max-height:180px}.public-reader pre{overflow:auto;background:#818b9818;padding:16px}.public-list>li{margin-bottom:24px;border-bottom:1px solid #818b9855;padding-bottom:20px}.public-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:24px;align-items:start}.public-split-right>div:first-child{order:2}.public-reader blockquote{border-left:3px solid #007780;padding-left:20px}@media(max-width:640px){.public-split{grid-template-columns:1fr}.public-split-right>div:first-child{order:0}}
</style>`;

function standalone(page: Page, locale: Locale, canonical: string, body: string) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(page.title)} | Fimel Studio</title><meta name="description" content="${e(page.summary)}"><link rel="canonical" href="${e(canonical)}">${fallbackStyle}</head><body><div id="root">${body}</div></body></html>`;
}
async function htmlResponse(request: Request, env: PageEnvironment, page: Page, locale: Locale, canonical: string, status = 200) {
  const body = `<div class="public-reader">${nav(locale)}<main><h1>${e(page.title)}</h1>${page.summary ? `<p>${e(page.summary)}</p>` : ''}${page.body}</main></div>`;
  let html: string;
  if (status !== 200) html = standalone(page, locale, canonical, body);
  else {
    const template = await boundedAsset(await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), { signal: AbortSignal.timeout(10_000) })), MAX_MARKDOWN);
    if (!/<div id="root"><\/div>/.test(template)) throw Error('Missing application root');
    const title = `${page.title} | Fimel Studio`, image = publicUrl(page.image, PUBLIC_ORIGIN + '/', true);
    html = template.replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
      .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${e(title)}</title>`)
      .replace(/<meta (name="(?:description|twitter:title|twitter:description|twitter:image)"|property="og:(?:title|description|image|url)") content="[^"]*"\s*\/?>/g, (original, key: string) => {
        const value = key.includes('title') ? title : key.includes('description') ? page.summary : key.includes('url') ? canonical : image;
        return value ? `<meta ${key} content="${e(value)}">` : original;
      })
      .replace('</head>', () => `<link rel="canonical" href="${e(canonical)}"><meta property="og:url" content="${e(canonical)}"><meta name="fimel-public-data" content="${DOWNLOAD_ORIGIN}/data/works.json">${fallbackStyle}</head>`)
      .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
  }
  return new Response(request.method === 'HEAD' ? null : html, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(status !== 200 ? { 'X-Robots-Tag': 'noindex', ...(status === 503 ? { 'Retry-After': '60' } : {}) } : {}),
  } });
}

/** Published roots are checked on every request; removing a project never serves an old cached copy. */
export async function publicPage(request: Request, env: PageEnvironment): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url), locale: Locale = url.searchParams.get('lang') === 'en' ? 'en' : url.searchParams.get('lang') === 'ja' ? 'ja' : 'zh';
  const text = labels[locale], path = url.pathname;
  const tab = PROJECT_TABS.includes(url.searchParams.get('tab') as ProjectTab) ? url.searchParams.get('tab') as ProjectTab : 'description';
  const canonical = PUBLIC_ORIGIN + pathFor(path, locale, tab !== 'description' && path.startsWith('/works/') ? { tab } : undefined);
  if (path === '/robots.txt') return new Response(request.method === 'HEAD' ? null : `User-agent: *\nAllow: /\nSitemap: ${PUBLIC_ORIGIN}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  if (path === '/index.html' || path.length > 1 && path.endsWith('/')) {
    return new Response(null, { status: 308, headers: { Location: (path === '/index.html' ? '/' : path.replace(/\/+$/, '')) + url.search } });
  }
  const aliases: Record<string, string> = { '/works/maps': 'bedrock', '/works/mods': 'mods', '/works/tools': 'tools' };
  if (Object.hasOwn(aliases, path)) {
    url.searchParams.set('type', aliases[path]);
    return new Response(null, { status: 308, headers: { Location: '/works?' + url.searchParams.toString() } });
  }
  try {
    if (path === '/sitemap.xml') {
      const [works, docs] = await Promise.all([workData(env), docsData(env)]);
      const entries = [ { path: '/' }, { path: '/works' }, { path: '/docs' },
        ...works.projects.map(project => ({ path: '/works/' + project.slug, date: releaseProject(project, works.releases[project.slug] ?? []).updated })),
        ...docs.documents.map(doc => ({ path: '/docs/' + doc.slug, date: doc.updatedAt })),
      ];
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<url><loc>${e(PUBLIC_ORIGIN + entry.path)}</loc>${'date' in entry && entry.date && /^\d{4}-\d\d-\d\d(?:T[\d:.]+Z)?$/.test(entry.date) ? `<lastmod>${e(entry.date)}</lastmod>` : ''}</url>`).join('')}</urlset>`;
      return new Response(request.method === 'HEAD' ? null : xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    let page: Page | undefined;
    if (path === '/' || path === '/works' || /^\/works\/[a-z0-9-]+$/.test(path)) {
      const data = await workData(env);
      if (path === '/' || path === '/works') {
        const projects = path === '/' || !url.searchParams.has('type') ? data.projects : data.projects.filter(project => project.type === url.searchParams.get('type'));
        page = { title: path === '/' ? 'Fimel Studio' : text.works, summary: path === '/' ? localizedText(data.site?.studio.description, locale) : '', body: projectList(projects, locale) || text.empty };
      } else {
        const slug = path.slice('/works/'.length), original = slugPattern.test(slug) && data.projects.find(project => project.slug === slug);
        if (original) {
          const versions = data.releases[original.slug] ?? [], project = releaseProject(original, versions);
          const source = localizedText(project.content[tab], locale);
          const image = publicUrl(project.image, PUBLIC_ORIGIN + '/', true);
          const body = tab === 'versions' ? releasesHtml(project, versions, locale) : source ? await workMarkdown(source, env, canonical) : '';
          page = { title: localizedText(project.title, locale), summary: localizedText(project.summary, locale), image: project.image,
            body: `${image ? `<img class="public-cover" src="${e(image)}" alt="${e(localizedText(project.title, locale))}">` : ''}<p>${e(project.platform.join(' · '))} · ${e(project.creators.map(creator => creator.name).join(', '))}</p><p>${e(text.published)}: ${e(project.published ?? '—')} · ${e(text.updated)}: ${e(project.updated ?? '—')}</p><p>${link(project.repository, text.repository)} ${link(project.store || project.releasePage, text.platform)}</p><nav>${PROJECT_TABS.map(value => link(pathFor(path, locale, value !== 'description' ? { tab: value } : undefined), text[value])).join('')}</nav><article>${body}</article>` };
        }
      }
    } else if (path === '/docs' || /^\/docs\/[a-z0-9-]+$/.test(path)) {
      const data = await docsData(env);
      if (path === '/docs') {
        const category = url.searchParams.get('category');
        const groups = [...data.categories].sort((a, b) => a.order - b.order).filter(group => !category || group.slug === category);
        const list = (categoryId: string) => `<ul>${data.documents.filter(doc => doc.categoryId === categoryId).sort((a, b) => a.order - b.order).map(doc => `<li>${link(pathFor('/docs/' + doc.slug, locale), docsLocalizedText(doc.title, locale))}<p>${e(docsLocalizedText(doc.summary, locale))}</p></li>`).join('')}</ul>`;
        page = { title: text.docs, summary: '', body: groups.map(group => `<section><h2>${e(docsLocalizedText(group.title, locale))}</h2><p>${e(docsLocalizedText(group.summary, locale))}</p>${list(group.id)}</section>`).join('') + (!category ? list('') : '') };
      } else {
        const doc = data.documents.find(doc => doc.slug === path.slice('/docs/'.length));
        if (doc) page = { title: docsLocalizedText(doc.title, locale), summary: docsLocalizedText(doc.summary, locale), body: `<p>${e(text.updated)}: <time datetime="${e(doc.updatedAt)}">${e(doc.updatedAt.slice(0, 10))}</time></p><article>${publicMarkdown(docsLocalizedText(doc.body, locale), PUBLIC_ORIGIN + '/', canonical)}</article>` };
      }
    }
    return await htmlResponse(request, env, page ?? { title: text.missing, summary: '', body: link('/works', text.works) + ' ' + link('/docs', text.docs) }, locale, canonical, page ? 200 : 404);
  } catch {
    // No raw exception, author content, session or environment values in logs.
    console.error(JSON.stringify({ event: 'public-page-unavailable', route: path.startsWith('/docs') ? 'docs' : path === '/sitemap.xml' ? 'sitemap' : 'works' }));
    return htmlResponse(request, env, { title: 'Fimel Studio', summary: text.unavailable, body: link(pathFor(path, locale), locale === 'zh' ? '重新读取' : 'Retry') }, locale, canonical, 503);
  }
}
