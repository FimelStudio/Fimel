import { useTranslation } from 'react-i18next';
import type { Project, LocalizedText } from '../../src/content/projects';
import { localizedText } from '../../src/content/projects';
import type { HomeSpotlight, SiteContent } from '../../src/content/site-content';
import { spotlightCopy } from '../../src/content/home-spotlights';
import type { Library, Locale } from '../shared/model';

const spotlightNames = { maps: '地图推荐卡', mods: '模组推荐卡', tools: '工具推荐卡' };
type SpotlightKey = keyof typeof spotlightNames;
const spotlightKeys = Object.keys(spotlightNames) as SpotlightKey[];
type Props = { site: SiteContent; locale: Locale; library: Library; publicProjects: Project[]; onChange(site: SiteContent): void };

export function HomeContentEditor({ site, locale, library, publicProjects, onChange }: Props) {
  const published = new Set(publicProjects.map(project => project.slug));
  const candidates = new Map(publicProjects.map(project => [project.slug, project]));
  for (const work of library.works) if (work.workflow !== 'archived' && !candidates.has(work.project.slug)) candidates.set(work.project.slug, work.project);
  const localText = (value: LocalizedText | undefined) => typeof value === 'string' ? locale === 'zh' ? value : '' : value?.[locale] ?? '';
  const changeLocale = (value: LocalizedText | undefined, text: string) => ({ ...typeof value === 'string' ? { zh: value } : value ?? {}, [locale]: text });
  const patch = (key: SpotlightKey, changes: Partial<HomeSpotlight>) => onChange({ ...site, home: {
    ...site.home, spotlights: { ...site.home?.spotlights, [key]: { ...site.home?.spotlights?.[key], ...changes } },
  } });
  return <section aria-label="首页快速推荐内容">
    <h2>首页快速推荐 · {locale}</h2>
    <p className="hint">管理首页快速推荐区的标题和三张卡片。各语言留空会沿用现有文案；关联作品后，标题、介绍与图片优先使用该作品的公开内容。未公开作品可先保存草稿，发布网站内容前须先公开该作品。</p>
    <label>快速推荐区标题<input aria-label="首页快速推荐区标题" maxLength={3000} value={localText(site.home?.quickTitle)} placeholder="留空使用官网现有标题" onChange={event => onChange({ ...site, home: { ...site.home, quickTitle: changeLocale(site.home?.quickTitle, event.target.value) } })}/></label>
    {spotlightKeys.map(key => {
      const value = site.home?.spotlights?.[key];
      const name = spotlightNames[key];
      const missing = !!value?.workSlug && !candidates.has(value.workSlug);
      const unpublished = !!value?.workSlug && !published.has(value.workSlug);
      return <section className="release-editor" aria-label={name} key={key}>
        <h3>{name}</h3><div className="form-grid">
          <label className="full">关联作品<select aria-label={`${name}关联作品`} value={value?.workSlug ?? ''} aria-invalid={unpublished} aria-describedby={`home-spotlight-${key}-hint`} onChange={event => patch(key, { workSlug: event.target.value || undefined })}>
            <option value="">不指定作品，沿用原分类入口与卡片图片</option>
            {missing && <option value={value!.workSlug} disabled>{value!.workSlug} · 当前作品不在作品库中</option>}
            {[...candidates.values()].map(project => <option key={project.slug} value={project.slug}>{localizedText(project.title, 'zh') || project.slug} · {project.slug}{published.has(project.slug) ? '' : ' · 尚未公开'}</option>)}
          </select></label>
          {(['label', 'title', 'summary'] as const).map(field => {
            const caption = { label: '分类短文', title: '标题', summary: '介绍' }[field];
            return <label className={field === 'summary' ? 'full' : undefined} key={field}>{caption} · {locale}<textarea aria-label={`${name}${caption}`} rows={field === 'summary' ? 3 : 2} maxLength={3000} value={localText(value?.[field])} placeholder="留空使用关联作品或官网现有文案" onChange={event => patch(key, { [field]: changeLocale(value?.[field], event.target.value) })}/></label>;
          })}
        </div>
        <p className="hint" id={`home-spotlight-${key}-hint`}>{unpublished ? '此关联作品尚未公开；可以保存网站草稿，公开作品并刷新状态后才能发布。' : value?.workSlug ? '此作品已公开，卡片将进入该作品详情。分类短文留空时显示该作品的分类名称。' : '未关联作品时，保留此卡片原有的分类入口、图片与默认文案。'}</p>
      </section>;
    })}
  </section>;
}

export function HomeContentPreview({ site, projects, locale }: { site: SiteContent; projects: Project[]; locale: Locale }) {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(locale);
  return <section aria-label="首页快速推荐发布预览">
    <h3>{localizedText(site.home?.quickTitle, locale) || t('home.quick_title')}</h3>
    <div className="form-grid">{spotlightKeys.map(key => {
      const config = site.home?.spotlights?.[key];
      const copy = spotlightCopy(key, config, projects, t, locale);
      const selected = config?.workSlug ? projects.find(project => project.slug === config.workSlug) : undefined;
      return <article className="release-editor" key={key}>
        <p className="hint">{spotlightNames[key]} · {copy.label}</p><h4>{copy.title}</h4><p>{copy.summary}</p>
        <p className="hint">{config?.workSlug ? `关联作品：${localizedText(selected?.title, locale) || config.workSlug}` : '沿用原分类入口'} · {copy.href}</p>
      </article>;
    })}</div>
  </section>;
}
