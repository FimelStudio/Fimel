import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { localizedText, formatProjectDate } from '../content/projects';
import type { SiteContent } from '../content/site-content';
import { useProjectCatalogue } from '../hooks/useProjectCatalogue';
export function RecentUpdatesList({updates,language,preview=false}:{updates:SiteContent['updates'];language:string;preview?:boolean}) {
  const title=language.startsWith('zh')?'近期更新':language.startsWith('ja')?'最近の更新':'Latest updates';
  if(!updates.length)return null;
  return <section id="recent-updates" className="border-t border-line bg-canvas px-6 py-16 text-content md:px-16 md:py-24 lg:px-24"><div className="mx-auto max-w-screen-xl"><h2 className="mb-8 text-3xl font-bold tracking-tight md:text-5xl">{title}</h2><div className="space-y-7">{[...updates].sort((a,b)=>b.date.localeCompare(a.date)).map(update=><article key={update.id} className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]"><time className="pt-1 font-mono text-xs text-content-muted" dateTime={update.date}>{formatProjectDate(update.date,language,'')}</time><div><h3 className="text-xl font-semibold">{update.workSlug&&!preview?<Link to={`/works/${update.workSlug}`} className="hover-target inline-flex min-h-11 items-center gap-3 hover:text-brand">{localizedText(update.title,language)}<ArrowUpRight size={17}/></Link>:update.url&&!preview?<a href={update.url} target="_blank" rel="noopener noreferrer" className="hover-target inline-flex min-h-11 items-center gap-3 hover:text-brand">{localizedText(update.title,language)}<ArrowUpRight size={17}/></a>:localizedText(update.title,language)}</h3><p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-content-muted">{localizedText(update.summary,language)}</p></div></article>)}</div></div></section>;
}
export function RecentUpdates() {
  const {site}=useProjectCatalogue();const {i18n}=useTranslation();
  return <RecentUpdatesList updates={site?.updates??[]} language={i18n.resolvedLanguage??'zh'}/>;
}
