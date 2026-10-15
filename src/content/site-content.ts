import type { LocalizedText } from './projects';
import { HOME_FEATURED } from './home-featured';
export type SiteContent = {
  schemaVersion: 1;
  featured: { maps: string[]; released: string[]; development: string[] };
  studio: { title?: LocalizedText; description?: LocalizedText; contactTitle?: LocalizedText; contactIntro?: LocalizedText };
  contact: { email: string; qqGroup: string; qqUrl: string; discord: string; x: string; github: string };
  updates: { id: string; title: LocalizedText; summary: LocalizedText; date: string; workSlug?: string; url?: string }[];
};
export const DEFAULT_SITE_CONTENT: SiteContent = {
  schemaVersion: 1, featured: { maps: [...HOME_FEATURED.maps], released: [...HOME_FEATURED.released], development: [...HOME_FEATURED.development] },
  studio: {}, contact: { email: 'fimel.studio.mc@gmail.com', qqGroup: '937760015', qqUrl: 'https://qm.qq.com/q/WVvNr3OocQ', discord: 'https://discord.gg/X9aVJJVvA', x: 'https://x.com/FimelStudio', github: 'https://github.com/FimelStudio' }, updates: [],
};
export function siteContentErrors(value: unknown): string[] {
  const bad = ['网站内容格式不合法，请检查字段、链接和三语文案。'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 150_000) return bad;
  const s = value as SiteContent;
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const exact = (item: unknown, keys: string[]) => object(item) && Object.keys(item).every(k => keys.includes(k));
  const text = (item: unknown, max = 3000) => typeof item === 'string' && item.length <= max;
  const localized = (item: unknown) => typeof item === 'string' ? text(item) : exact(item, ['zh','en','ja']) && Object.values(item as object).every(v => text(v));
  const url = (item: unknown) => { try { const u = new URL(String(item)); return text(item, 500) && u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
  const slug = (item: unknown) => typeof item === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item);
  if (!exact(s, ['schemaVersion','featured','studio','contact','updates']) || s.schemaVersion !== 1 || !exact(s.featured, ['maps','released','development']) ||
    !['maps','released','development'].every(k => { const a=s.featured[k as keyof SiteContent['featured']];return Array.isArray(a)&&a.length<=12&&new Set(a).size===a.length&&a.every(slug); }) ||
    !exact(s.studio, ['title','description','contactTitle','contactIntro']) || !Object.values(s.studio).every(localized) ||
    !exact(s.contact, ['email','qqGroup','qqUrl','discord','x','github']) || !text(s.contact.email,254) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s.contact.email) || !/^\d{5,15}$/.test(s.contact.qqGroup) ||
    !['qqUrl','discord','x','github'].every(k=>url(s.contact[k as keyof SiteContent['contact']])) || !Array.isArray(s.updates) || s.updates.length > 30) return bad;
  const ids=new Set<string>();
  for(const update of s.updates){
    if(!exact(update,['id','title','summary','date','workSlug','url']) || typeof update.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(update.id) || ids.has(update.id) ||
      !localized(update.title)||!Object.values(typeof update.title==='string'?{zh:update.title}:update.title).some(v=>v?.trim())||!localized(update.summary)||!/^\d{4}-\d{2}-\d{2}$/.test(update.date)||!Number.isFinite(Date.parse(update.date))||update.workSlug!==undefined&&!slug(update.workSlug)||update.url!==undefined&&!url(update.url))return bad;
    ids.add(update.id);
  }
  return [];
}
export function parseSiteContent(value: unknown): SiteContent | undefined {
  if (!value || typeof value !== 'object' || !('site' in value) || value.site === undefined) return;
  if (siteContentErrors(value.site).length) throw Error('Invalid public site content.');
  return value.site as SiteContent;
}
