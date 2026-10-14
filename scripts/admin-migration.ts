import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import i18n from '../src/i18n';
import { LOCALES } from '../admin/shared/model';
import type { Library, Work } from '../admin/shared/model';
import type { Project, ProjectTab } from '../src/content/projects';
import { validateLibrary, librarySchema } from '../admin/shared/validation';

const root = resolve('public');
const catalogue = JSON.parse(await readFile(resolve(root,'works/catalogue.json'),'utf8')) as { projects: Project[] };
const now = new Date().toISOString();
const works: Work[] = [];
for (const [order, original] of catalogue.projects.entries()) {
  const project = structuredClone(original);
  for (const field of ['title','summary'] as const) {
    const key = original.translations?.[field];
    if (key) {
      const localized = Object.fromEntries(LOCALES.map(locale => {
        if (!i18n.exists(key,{lng:locale})) throw new Error(`Missing ${locale} translation: ${key}`);
        return [locale,i18n.t(key,{lng:locale})];
      }));
      project[field] = localized;
    }
  }
  delete project.translations;
  if (!project.image.startsWith('https:')) project.image = `https://studiofimel.com/${project.image}`;
  const markdown: Work['markdown'] = { description:{},changelog:{},versions:{} };
  for (const tab of ['description','changelog','versions'] as ProjectTab[]) {
    const value = original.content[tab];
    const paths = typeof value === 'string' ? {zh:value} : value ?? {};
    for (const [locale,path] of Object.entries(paths)) {
      const absolute = resolve(root,path); const rel = relative(root,absolute);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Content path outside public root');
      const body = await readFile(absolute,'utf8');
      const base = new URL(path,'https://studiofimel.com/');
      // Preserve existing relative media semantics when the Markdown moves to R2.
      const migrated = body.replace(/(!?\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (full:string,prefix:string,url:string,suffix:string) => {
        if (url.startsWith('#/') || /^[a-z][a-z0-9+.-]*:/i.test(url)) return full;
        return `${prefix}${new URL(url,base).href}${suffix}`;
      });
      markdown[tab][locale as typeof LOCALES[number]] = migrated;
    }
  }
  works.push({ id:original.slug,project,legacy:original,workflow:'ready',order,markdown,gallery:[],versions:[],createdAt:now,updatedAt:now });
}
const library: Library = {schemaVersion:1,works};
const errors=validateLibrary(library); if(errors.length)throw new Error(errors.join('\n'));
const directory=resolve('.artifacts/admin-migration'); await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,'library.json'),JSON.stringify(library,null,2));
await writeFile(resolve(directory,'library.schema.json'),JSON.stringify(librarySchema,null,2));
const report={baseline:'e018113',generatedAt:now,count:works.length,productionWrites:0,
  mapping:works.map(w=>({id:w.id,slug:w.project.slug,type:w.project.type,translatedFields:Object.keys(w.legacy?.translations??{}),
    retainedFields:Object.keys(w.legacy??{}),inlineMarkdownLocales:Object.fromEntries(Object.entries(w.markdown).map(([tab,body])=>[tab,Object.keys(body)])),
    existingDownload:w.project.downloadUrl??null})),
  notes:['制作中作品可以作为已公开介绍，但不包含虚构下载。','现有封面/图片及旧地址保留在官网，Markdown 相对链接转换为原有官网绝对地址。','三语指针解析为真实文案，原始记录保留在 legacy 私有字段。','原 3 个 R2 下载保留，发布前必须通过真实桶对象存在校验。','此脚本没有任何云端写入、推送或迁移执行。']};
await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));
console.log(`Migration preview: ${works.length} works; all original fields retained; no production writes. Output: .artifacts/admin-migration`);
