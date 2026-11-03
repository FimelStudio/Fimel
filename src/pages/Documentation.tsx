import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, FileText, Search, X } from 'lucide-react';
import { docsLocalizedText as localizedText } from '../content/docs';
import { documentationHeadings } from '../content/documentation-markdown';
import { DocumentationBody } from '../components/DocumentationBody';
import { useDocumentation } from '../hooks/useDocumentation';
import './Documentation.css';

const labels = {
  zh: { title: '文档', intro: '游戏规则、安装指南与创作参考。', search: '搜索文档标题与正文', clear: '清除搜索', categories: '文档分类', all: '全部文档', empty: '文档正在整理中', emptyText: '公开后的指南与游戏规则将在这里展示。', failed: '暂时无法读取文档', failedText: '请稍后重试；不会用示例内容替代已发布文档。', retry: '重新读取', missing: '没有找到这篇文档', missingText: '文档可能尚未公开，或已经从文档中心移除。', back: '返回文档目录', contents: '本页内容', previous: '上一篇', next: '下一篇', noResults: '没有找到匹配的文档', count: '篇文档', updated: '更新于', work: '查看关联作品', fallback: '此文档暂未提供当前语言，以下显示已有语言内容。', stale: '更新检查暂时失败，当前保留上次成功读取的内容。', navigation: '展开文档导航' },
  en: { title: 'Documentation', intro: 'Game rules, installation guides and references for creators.', search: 'Search document titles and content', clear: 'Clear search', categories: 'Categories', all: 'All documents', empty: 'Documentation is on its way', emptyText: 'Published guides and game rules will appear here.', failed: 'Documentation is unavailable', failedText: 'Please retry shortly. Published content is never replaced with sample content.', retry: 'Retry', missing: 'Document not found', missingText: 'This document may not be published or may have been removed.', back: 'Back to documentation', contents: 'On this page', previous: 'Previous', next: 'Next', noResults: 'No matching documents', count: 'documents', updated: 'Updated', work: 'View project', fallback: 'This document is not available in the current language. An existing translation is shown below.', stale: 'Could not check for updates. Showing the last successfully loaded content.', navigation: 'Show documentation navigation' },
  ja: { title: 'ドキュメント', intro: 'ゲームルール、導入ガイドと制作のための資料。', search: 'タイトルと本文を検索', clear: '検索をクリア', categories: 'カテゴリー', all: 'すべてのドキュメント', empty: 'ドキュメントを準備しています', emptyText: '公開されたガイドとゲームルールがここに表示されます。', failed: 'ドキュメントを読み込めません', failedText: 'しばらくしてから再試行してください。公開内容をサンプルに置き換えることはありません。', retry: '再試行', missing: 'ドキュメントが見つかりません', missingText: 'まだ公開されていないか、一覧から削除された可能性があります。', back: 'ドキュメント一覧へ', contents: 'このページの内容', previous: '前へ', next: '次へ', noResults: '一致するドキュメントはありません', count: '件のドキュメント', updated: '更新日', work: '作品を見る', fallback: 'この言語の翻訳はまだありません。既存の言語を表示します。', stale: '更新を確認できません。最後に読み込んだ内容を表示しています。', navigation: 'ナビゲーションを開く' },
};

export function Documentation() {
  const { slug } = useParams(); const [params, setParams] = useSearchParams();
  const { i18n } = useTranslation(); const language = i18n.resolvedLanguage?.split('-')[0] ?? 'zh';
  const copy = labels[language as keyof typeof labels] ?? labels.zh;
  const { data, error, retry } = useDocumentation();
  const [query, setQuery] = useState(''); const [menu, setMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null); const contentRef = useRef<HTMLElement>(null);
  const doc = data?.documents.find(value => value.slug === slug);
  const category = data?.categories.find(value => value.id === doc?.categoryId);
  const categoryFilter = params.get('category');
  const sorted = useMemo(() => [...(data?.documents ?? [])].sort((a, b) => a.order - b.order || localizedText(a.title, language).localeCompare(localizedText(b.title, language))), [data, language]);
  const categories = useMemo(() => [...(data?.categories ?? [])].sort((a, b) => a.order - b.order), [data]);
  const list = sorted.filter(value => (!categoryFilter || data?.categories.find(c => c.id === value.categoryId)?.slug === categoryFilter) && (!query.trim() || JSON.stringify([value.title, value.summary, value.body, value.slug]).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const inCategory = sorted.filter(value => value.categoryId === doc?.categoryId); const position = inCategory.findIndex(value => value.id === doc?.id);
  const body = doc ? localizedText(doc.body, language) : '';
  const headings = useMemo(() => documentationHeadings(body).filter(item => item.depth === 2 || item.depth === 3), [body]);
  const section = params.get('section');
  useEffect(() => {
    const frame = requestAnimationFrame(() => { if (section) { const element = document.getElementById(section); element?.scrollIntoView({ block: 'start' }); } });
    return () => cancelAnimationFrame(frame);
  }, [section, body]);
  useEffect(() => {
    const title = doc ? `${localizedText(doc.title, language)} · ${copy.title} · Fimel Studio` : `${copy.title} · Fimel Studio`;
    const previous = document.title; document.title = title; return () => { document.title = previous; };
  }, [doc, language, copy.title]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setMenu(true); requestAnimationFrame(() => searchRef.current?.focus()); } }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, []);
  const search = <div className="docs-search"><Search size={17} aria-hidden="true"/><input ref={searchRef} type="search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={event => setQuery(event.target.value)}/>{query ? <button type="button" aria-label={copy.clear} onClick={() => setQuery('')}><X size={16}/></button> : <kbd>Ctrl K</kbd>}</div>;
  if (!data) return <div className="documentation-page docs-status"><BookOpen size={28}/>{error ? <><h1>{copy.failed}</h1><p>{copy.failedText}</p><button onClick={retry}>{copy.retry}</button></> : <p role="status">{language === 'en' ? 'Loading documentation…' : language === 'ja' ? '読み込み中…' : '正在读取文档…'}</p>}</div>;
  return <div className="documentation-page">
    <div className="docs-mobile-toolbar"><Link to="/docs"><BookOpen size={17}/>{copy.title}</Link><button type="button" aria-expanded={menu} aria-controls="docs-sidebar" onClick={() => setMenu(value => !value)}>{copy.categories}<ChevronDown size={16}/></button></div>
    <div className="docs-layout">
      <aside id="docs-sidebar" className={`docs-sidebar ${menu ? 'docs-sidebar-open' : ''}`} aria-label={copy.categories} onClick={event => { if ((event.target as HTMLElement).closest('a')) setMenu(false); }}>
        <Link to="/docs" className="docs-brand-title"><BookOpen size={20}/>{copy.title}</Link>
        {search}
        {query && <div className="docs-search-results" role="region" aria-label={copy.search}>{list.length ? list.map(value => <Link key={value.id} to={`/docs/${value.slug}`} className={value.id === doc?.id ? 'current' : ''}><FileText size={14}/>{localizedText(value.title, language)}</Link>) : <p>{copy.noResults}</p>}</div>}
        <nav aria-label={copy.categories}>
          <Link to="/docs" className={`docs-all-link ${!slug && !categoryFilter ? 'current' : ''}`}>{copy.all}<span>{data.documents.length}</span></Link>
          {categories.map(value => { const children = sorted.filter(page => page.categoryId === value.id); return <div className="docs-nav-category" key={value.id}><Link to={`/docs?category=${value.slug}`} className="docs-category-title">{localizedText(value.title, language)}<span>{children.length}</span></Link>{children.map(page => <Link key={page.id} to={`/docs/${page.slug}`} aria-current={page.id === doc?.id ? 'page' : undefined} className={page.id === doc?.id ? 'current' : ''}>{localizedText(page.title, language)}</Link>)}</div>; })}
        </nav>
      </aside>
      <article ref={contentRef} className="docs-article" aria-label={doc ? localizedText(doc.title, language) : copy.title}>
        {error && <p className="docs-notice" role="status">{copy.stale} <button type="button" onClick={retry}>{copy.retry}</button></p>}
        {slug && !doc ? <div className="docs-empty"><FileText size={28}/><h1>{copy.missing}</h1><p>{copy.missingText}</p><Link to="/docs">{copy.back}<ArrowRight size={16}/></Link></div> : doc ? <>
          <div className="docs-breadcrumb"><Link to="/docs">{copy.title}</Link><span>/</span>{category && <Link to={`/docs?category=${category.slug}`}>{localizedText(category.title, language)}</Link>}</div>
          <header className="docs-document-header"><h1>{localizedText(doc.title, language)}</h1>{localizedText(doc.summary, language) && <p>{localizedText(doc.summary, language)}</p>}<div className="docs-meta"><span>{copy.updated} {new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(doc.updatedAt))}</span>{category?.workSlug && <Link to={`/works/${category.workSlug}`}>{copy.work}<ArrowRight size={14}/></Link>}</div></header>
          {!doc.body[language as keyof typeof doc.body]?.trim() && <p className="docs-notice">{copy.fallback}</p>}
          <DocumentationBody content={body} fileUrl={new URL(import.meta.env.BASE_URL, window.location.origin)}/>
          <nav className="docs-pagination" aria-label={`${copy.previous} / ${copy.next}`}>{position > 0 ? <Link to={`/docs/${inCategory[position - 1].slug}`}><ArrowLeft size={17}/><span><small>{copy.previous}</small>{localizedText(inCategory[position - 1].title, language)}</span></Link> : <span/>}{position + 1 < inCategory.length && <Link to={`/docs/${inCategory[position + 1].slug}`}><span><small>{copy.next}</small>{localizedText(inCategory[position + 1].title, language)}</span><ArrowRight size={17}/></Link>}</nav>
        </> : <>
          <header className="docs-document-header"><h1>{categoryFilter ? localizedText(categories.find(value => value.slug === categoryFilter)?.title, language) || copy.title : copy.title}</h1><p>{categoryFilter ? localizedText(categories.find(value => value.slug === categoryFilter)?.summary, language) || copy.intro : copy.intro}</p></header>
          {!data.documents.length ? <div className="docs-empty"><BookOpen size={32}/><h2>{copy.empty}</h2><p>{copy.emptyText}</p></div> : !list.length ? <p className="docs-notice">{copy.noResults}</p> : <div className="docs-index-list">{list.map(value => <Link to={`/docs/${value.slug}`} key={value.id}><FileText size={20}/><div><span>{localizedText(categories.find(item => item.id === value.categoryId)?.title, language)}</span><h2>{localizedText(value.title, language)}</h2>{localizedText(value.summary, language) && <p>{localizedText(value.summary, language)}</p>}</div><ArrowRight size={18}/></Link>)}</div>}
        </>}
      </article>
      <aside className="docs-toc" aria-label={copy.contents}>{doc && headings.length > 0 && <><strong>{copy.contents}</strong><nav>{headings.map(value => <button key={value.id} type="button" className={`${value.depth === 3 ? 'docs-toc-child' : ''} ${section === value.id ? 'current' : ''}`} onClick={() => setParams({ section: value.id })}>{value.text}</button>)}</nav></>}</aside>
    </div>
  </div>;
}
