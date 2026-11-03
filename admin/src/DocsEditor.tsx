import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArrowDown, ArrowUp, BookOpen, Check, FilePlus, FolderPlus, ImagePlus, Search, Upload } from 'lucide-react';
import type { DocsCategory } from '../../src/content/docs';
import { DOCS_MAX_BYTES, docsBody, docsDate, docsId, docsKeys, docsLocalizedText, docsRecord, docsText } from '../../src/content/docs';
import { DocumentationBody } from '../../src/components/DocumentationBody';
import type { LocalizedText } from '../../src/content/projects';
import { docsLibraryErrors, makeDoc, makeDocsCategory, replaceDocsImages, validDocsImage } from '../shared/docs';
import type { DocDraft, DocsExampleSource, DocsLibrary, DocsPreview, DocsState, PublicDoc } from '../shared/docs';
import { LOCALES, MAX_IMAGE_SIZE, PUBLIC_ORIGIN } from '../shared/model';
import type { Asset, Locale } from '../shared/model';
import { stable } from '../shared/revisions';
import { api, RequestError } from './api';
import { browserTabId, recoveryStore } from './draft-recovery';
import { DocsTree } from './DocsTree';
import type { DocsTreeHandle } from './DocsTree';
import './DocsEditor.css';

type Props = { actorId: string | null; onDirtyChange(value: boolean): void; onBusyChange(value: boolean): void };
type Recovery = { key: string; at: string; library: DocsLibrary; etag: string; selected: string | null };
type CategoryDialog = { category: DocsCategory; creating: boolean };
type Change = 'added' | 'changed' | 'removed';
const workflowNames = { draft: '私有草稿', ready: '待发布', archived: '已归档' };
const ROOT_LABEL = '根目录（独立文档）';
const textAt = (text: LocalizedText, locale: Locale) => typeof text === 'string' ? locale === 'zh' ? text : '' : text[locale] ?? '';
const changedText = (text: LocalizedText, locale: Locale, value: string) => ({ ...typeof text === 'string' ? { zh: text } : text, [locale]: value });
const sorted = <T extends { order: number }>(items: T[]) => [...items].sort((a, b) => a.order - b.order);
const docTitle = (doc: { title: LocalizedText; slug: string }) => docsLocalizedText(doc.title, 'zh') || doc.slug;
function publicationStatus(doc: DocDraft, published: PublicDoc | undefined): string {
  if (!published) return `未公开 · ${workflowNames[doc.workflow]}`;
  if (doc.workflow !== 'ready') return '已公开 · 下次发布将下架';
  const project = (value: Pick<PublicDoc, 'id' | 'slug' | 'categoryId' | 'title' | 'summary' | 'body' | 'order'>) => {
    const { id, slug, categoryId, title, summary, body, order } = value; return { id, slug, categoryId, title, summary, body, order };
  };
  const urls = new Map(doc.images.map(asset => [asset.id, `${PUBLIC_ORIGIN}/docs/images/${doc.slug}/${asset.id}/${asset.name}`]));
  const current = project({ ...doc, body: replaceDocsImages(doc.body, urls) });
  return stable(current) === stable(project(published)) ? '已公开 · 已同步' : '已公开 · 有修改待发布';
}
function exportJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return createPortal(<div className="admin-shell docs-dialog-portal"><dialog ref={ref} className="modal docs-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><h2>{title}</h2>{children}</dialog></div>, document.body);
}
function recoverable(record: unknown): record is Recovery {
  try {
    if (!docsRecord(record) || !docsKeys(record, ['key', 'at', 'library', 'etag', 'selected']) || new TextEncoder().encode(JSON.stringify(record)).byteLength > DOCS_MAX_BYTES + 4096) return false;
    if (typeof record.key !== 'string' || record.key.length > 300 || !docsDate(record.at) || typeof record.etag !== 'string' || record.etag.length > 200 || /[\r\n]/.test(record.etag) || record.selected !== null && !docsId(record.selected)) return false;
    const value = record.library;
    if (!docsRecord(value) || !docsKeys(value, ['schemaVersion', 'categories', 'documents']) || value.schemaVersion !== 1 || !Array.isArray(value.categories) || value.categories.length > 50 || !Array.isArray(value.documents) || value.documents.length > 300) return false;
    const order = (item: unknown) => Number.isSafeInteger(item) && Math.abs(item as number) <= 100000;
    // Half-written titles and slugs are recoverable; object shapes must be safe to render.
    const slugInput = (item: unknown) => typeof item === 'string' && item.length <= 1000;
    const categoryIds = new Set<string>(), documentIds = new Set<string>(), imageIds = new Set<string>();
    for (const category of value.categories) {
      if (!docsRecord(category) || !docsKeys(category, ['id', 'slug', 'title', 'summary', 'order', 'workSlug']) || !docsId(category.id) || categoryIds.has(category.id) || !slugInput(category.slug) || !docsText(category.title, 160) || !docsText(category.summary, 600) || !order(category.order) || category.workSlug !== undefined && !slugInput(category.workSlug)) return false;
      categoryIds.add(category.id);
    }
    for (const doc of value.documents) {
      if (!docsRecord(doc) || !docsKeys(doc, ['id', 'slug', 'categoryId', 'title', 'summary', 'body', 'order', 'workflow', 'images', 'createdAt', 'updatedAt']) || !docsId(doc.id) || documentIds.has(doc.id) || !(doc.categoryId === '' || docsId(doc.categoryId) && categoryIds.has(doc.categoryId)) || !slugInput(doc.slug) || !docsText(doc.title, 160) || !docsText(doc.summary, 600) || !docsBody(doc.body) || !order(doc.order) || !['draft', 'ready', 'archived'].includes(doc.workflow as string) || !docsDate(doc.createdAt) || !docsDate(doc.updatedAt) || !Array.isArray(doc.images) || doc.images.length > 40) return false;
      for (const asset of doc.images) { if (!validDocsImage(asset, doc.id) || imageIds.has(asset.id)) return false; imageIds.add(asset.id); }
      documentIds.add(doc.id);
    }
    return record.selected === null || documentIds.has(record.selected as string);
  } catch { return false; }
}

export function DocsEditor({ actorId, onDirtyChange, onBusyChange }: Props) {
  const [state, setState] = useState<DocsState | null>(null), [library, setLibrary] = useState<DocsLibrary | null>(null), [etag, setEtag] = useState('');
  const [original, setOriginal] = useState(''), [selected, setSelected] = useState<string | null>(null), [locale, setLocale] = useState<Locale>('zh');
  const [search, setSearch] = useState(''), [categoryFilter, setCategoryFilter] = useState(''), [workflowFilter, setWorkflowFilter] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [conflict, setConflict] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog | null>(null), [mergeFrom, setMergeFrom] = useState(''), [mergeTo, setMergeTo] = useState(''), [manageCategories, setManageCategories] = useState(false);
  const [preview, setPreview] = useState<DocsPreview | null>(null), [example, setExample] = useState<DocsExampleSource | null>(null), [importing, setImporting] = useState('');
  const [checked, setChecked] = useState<Set<string>>(() => new Set()), [archiveReview, setArchiveReview] = useState(false);
  const [contextCategory, setContextCategory] = useState<string | null>(null), [deleteReview, setDeleteReview] = useState<{ kind: 'doc' | 'category'; id: string } | null>(null);
  const treeRef = useRef<DocsTreeHandle>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null), [recoveryReady, setRecoveryReady] = useState(false), [uploading, setUploading] = useState('');
  const bodyInput = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), active = useRef(true), currentLibrary = useRef(library), requestLock = useRef(false);
  const callbacks = useRef({ onBusyChange, onDirtyChange });
  const dirty = !!library && !!original && stable(library) !== original;
  const selectedDoc = library?.documents.find(doc => doc.id === selected);
  const savedDoc = state?.library.documents.find(doc => doc.id === selected);
  const previewBody = selectedDoc ? docsLocalizedText(selectedDoc.body, locale) : '';
  const previewLanguageNote = selectedDoc?.body[locale]?.trim() ? '' : previewBody.trim() ? ' · 当前语言为空，预览已有语言内容' : ' · 当前语言尚无正文';
  const locked = busy || !!uploading;
  const recoveryKey = actorId ? `docs:${actorId}:${browserTabId()}` : null;
  useEffect(() => { callbacks.current = { onBusyChange, onDirtyChange }; }, [onBusyChange, onDirtyChange]);
  useEffect(() => { currentLibrary.current = library; }, [library]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(locked); }, [locked, onBusyChange]);
  useEffect(() => { active.current = true; return () => { active.current = false; callbacks.current.onBusyChange(false); callbacks.current.onDirtyChange(false); }; }, []);
  const accept = useCallback((next: DocsState, revision: string) => {
    setState(next); setLibrary(next.library); currentLibrary.current = next.library; setOriginal(stable(next.library)); setEtag(revision || next.etag); setPreview(null); setConflict(false);
  }, []);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const result = await api<DocsState>('docs', { signal: AbortSignal.timeout(20000) }); if (active.current) accept(result.data, result.etag); }
    catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : '读取文档失败。'); }
    finally { if (active.current) setBusy(false); }
  }, [accept]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!actorId) return;
    let cancelled = false;
    void recoveryStore<unknown[]>('', 'list').then(records => {
      if (cancelled) return;
      const eligible = records.filter(recoverable).filter(r => r.key.startsWith(`docs:${actorId}:`) && Date.parse(r.at) > Date.now() - 7 * 86400000).sort((a, b) => b.at.localeCompare(a.at));
      setRecovery(eligible.find(r => r.key === recoveryKey) ?? eligible[0] ?? null); setRecoveryReady(true);
    }).catch(() => { if (!cancelled) { setRecoveryReady(true); setError('本机恢复记录不可用，请及时保存或导出文档。'); } });
    return () => { cancelled = true; };
  }, [actorId, recoveryKey]);
  useEffect(() => {
    if (!recoveryKey || !recoveryReady || recovery?.key === recoveryKey || !library) return;
    const timer = window.setTimeout(() => {
      void recoveryStore(recoveryKey, dirty ? 'put' : 'delete', dirty ? { key: recoveryKey, at: new Date().toISOString(), library, etag, selected } : undefined).catch(() => setError('本机文档备份失败，请保存草稿或导出。'));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [recoveryKey, recoveryReady, recovery, library, etag, selected, dirty]);
  function showError(cause: unknown, fallback: string) {
    setConflict(cause instanceof RequestError && cause.status === 409);
    const networkFailure = cause instanceof TypeError || cause instanceof DOMException && ['AbortError', 'TimeoutError'].includes(cause.name);
    setError(cause instanceof Error && !networkFailure ? cause.message : fallback);
  }
  function edit(next: DocsLibrary) { setLibrary(next); currentLibrary.current = next; setPreview(null); setMessage(''); }
  function updateDoc(patch: Partial<DocDraft>) {
    if (!library || !selectedDoc || locked) return;
    edit({ ...library, documents: library.documents.map(doc => doc.id === selectedDoc.id ? { ...doc, ...patch, updatedAt: new Date().toISOString() } : doc) });
  }
  async function saveLibrary(next: DocsLibrary, revision = etag) {
    const errors = docsLibraryErrors(next); if (errors.length) throw new Error(errors.join('\n'));
    const result = await api<DocsState>('docs', { method: 'PUT', headers: { 'If-Match': revision }, body: JSON.stringify({ library: next }), signal: AbortSignal.timeout(30000) });
    if (active.current) { accept(result.data, result.etag); if (recoveryKey) await recoveryStore(recoveryKey, 'delete').catch(() => {}); setRecovery(null); }
    return result;
  }
  async function save() {
    if (!library || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(''); setMessage('');
    try { await saveLibrary(library); if (active.current) setMessage('文档草稿已保存，官网尚未更新。请将需要公开的文章设为“待发布”，再预览并确认发布。'); }
    catch (cause) { if (active.current) showError(cause, '保存失败，当前编辑已保留。'); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  }
  function generatedSlug(name: string, prefix: string, id: string, existing: string[]) {
    const readable = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
    const candidate = readable || `${prefix}-${id.slice(0, 8)}`;
    return existing.includes(candidate) ? `${candidate}-${id.slice(0, 8)}` : candidate;
  }
  function createDoc(categoryId: string, name: string) {
    if (!library || locked || library.documents.length >= 300) return;
    if (categoryId && !library.categories.some(category => category.id === categoryId)) return;
    const doc = makeDoc(categoryId, library.documents.filter(d => d.categoryId === categoryId).length);
    doc.title = { [locale]: name }; doc.slug = generatedSlug(name, 'doc', doc.id, library.documents.map(item => item.slug));
    edit({ ...library, documents: [...library.documents, doc] }); setSelected(doc.id); setSearch(''); setWorkflowFilter('');
    setContextCategory(categoryId); if (categoryFilter && categoryFilter !== (categoryId || '__root__')) setCategoryFilter(categoryId || '__root__');
  }
  function createCategory(name: string) {
    if (!library || locked || library.categories.length >= 50) return;
    const category = makeDocsCategory(library.categories.length); category.title = { [locale]: name }; category.slug = generatedSlug(name, 'category', category.id, library.categories.map(item => item.slug));
    edit({ ...library, categories: [...library.categories, category] }); setContextCategory(category.id); setCategoryFilter('');
  }
  function renameDoc(id: string, name: string) {
    if (!library || locked) return;
    if (textAt(library.documents.find(doc => doc.id === id)?.title ?? '', locale) === name) return;
    edit({ ...library, documents: library.documents.map(doc => doc.id === id ? { ...doc, title: changedText(doc.title, locale, name), updatedAt: new Date().toISOString() } : doc) });
  }
  function renameCategory(id: string, name: string) {
    if (!library || locked) return;
    edit({ ...library, categories: library.categories.map(category => category.id === id ? { ...category, title: changedText(category.title, locale, name) } : category) });
  }
  function moveDoc(id: string, categoryId: string) {
    if (!library || locked || categoryId && !library.categories.some(category => category.id === categoryId)) return;
    const doc = library.documents.find(item => item.id === id); if (!doc || doc.categoryId === categoryId) return;
    const order = library.documents.filter(item => item.categoryId === categoryId).length;
    edit({ ...library, documents: library.documents.map(item => item.id === id ? { ...item, categoryId, order, updatedAt: new Date().toISOString() } : item) });
    setContextCategory(categoryId); if (categoryFilter && categoryFilter !== (categoryId || '__root__')) setCategoryFilter(categoryId || '__root__');
  }
  function deleteItem() {
    if (!library || !deleteReview || locked) return;
    if (deleteReview.kind === 'doc') {
      edit({ ...library, documents: library.documents.map(doc => doc.id === deleteReview.id ? { ...doc, workflow: 'archived', updatedAt: new Date().toISOString() } : doc) });
    } else {
      if (library.documents.some(doc => doc.categoryId === deleteReview.id)) return;
      edit({ ...library, categories: library.categories.filter(category => category.id !== deleteReview.id) });
      if (contextCategory === deleteReview.id) setContextCategory(''); if (categoryFilter === deleteReview.id) setCategoryFilter('');
    }
    setDeleteReview(null);
  }
  function reorder(doc: DocDraft, direction: -1 | 1) {
    if (!library || locked) return;
    const siblings = sorted(library.documents.filter(d => d.categoryId === doc.categoryId && d.workflow !== 'archived'));
    const index = siblings.findIndex(d => d.id === doc.id), target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    const positions = new Map(siblings.map((item, order) => [item.id, order]));
    edit({ ...library, documents: library.documents.map(item => positions.has(item.id) ? { ...item, order: positions.get(item.id)!, updatedAt: new Date().toISOString() } : item) });
  }
  function reorderCategory(category: DocsCategory, direction: -1 | 1) {
    if (!library || locked) return;
    const items = sorted(library.categories), index = items.findIndex(item => item.id === category.id), target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    edit({ ...library, categories: items.map((item, order) => ({ ...item, order })) });
  }
  function saveCategory() {
    if (!library || !categoryDialog) return;
    const category = categoryDialog.category;
    const next = { ...library, categories: categoryDialog.creating ? [...library.categories, category] : library.categories.map(item => item.id === category.id ? category : item) };
    const errors = docsLibraryErrors({ ...next, documents: [] });
    if (errors.length) { setError('分类名称或 slug 不合法，slug 请使用小写英文字母、数字与连字符，名称至少填写一种语言。'); return; }
    edit(next); setCategoryDialog(null); setError('');
  }
  function mergeCategories() {
    if (!library || !mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
    const start = library.documents.filter(doc => doc.categoryId === mergeTo).length;
    let order = start;
    edit({ ...library, categories: library.categories.filter(c => c.id !== mergeFrom), documents: library.documents.map(doc => doc.categoryId === mergeFrom ? { ...doc, categoryId: mergeTo, order: order++, updatedAt: new Date().toISOString() } : doc) });
    if (categoryFilter === mergeFrom) setCategoryFilter(mergeTo);
    if (contextCategory === mergeFrom) setContextCategory(mergeTo);
    setMergeFrom(''); setMergeTo(''); setMessage('分类已在本机合并；文章地址保持不变。点击“保存文档草稿”后一次性保存，发布前官网不变。');
  }
  function changeSelectedWorkflow(workflow: DocDraft['workflow']) {
    if (!library || locked || !checked.size) return;
    const chosen = library.documents.filter(doc => checked.has(doc.id));
    if (workflow === 'ready' && chosen.some(doc => !Object.values(doc.body).some(text => text?.trim()))) {
      setError('所选文章中有空正文，请先补充内容，再批量设为待发布。当前文章状态未改变。'); return;
    }
    edit({ ...library, documents: library.documents.map(doc => checked.has(doc.id) ? { ...doc, workflow, updatedAt: new Date().toISOString() } : doc) });
    setError(''); setChecked(new Set()); setArchiveReview(false);
    setMessage(`已将 ${chosen.length} 篇文档设为“${workflowNames[workflow]}”，尚未保存。保存草稿并预览发布后官网才更新。`);
  }
  async function openPreview() {
    if (dirty || !state || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await api<DocsPreview>('docs/preview', { method: 'POST', headers: { 'If-Match': etag, 'X-Public-ETag': state.publicEtag }, body: '{}', signal: AbortSignal.timeout(30000) }); if (active.current) setPreview(result.data); }
    catch (cause) { if (active.current) showError(cause, '无法生成发布差异。'); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  }
  async function publish() {
    if (!preview || !state || dirty || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError('');
    try {
      await api('docs/publish', { method: 'POST', headers: { 'If-Match': etag, 'X-Public-ETag': state.publicEtag }, body: '{}', signal: AbortSignal.timeout(60000) });
      if (active.current) { setPreview(null); setMessage('文档已发布，官网文档中心将读取新的公开内容。'); }
      const refreshed = await api<DocsState>('docs', { signal: AbortSignal.timeout(20000) }); if (active.current) accept(refreshed.data, refreshed.etag);
    } catch (cause) { if (active.current) showError(cause, '发布结果尚未确认，请重新读取核对，当前草稿保留。'); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  }
  async function previewExample() {
    if (requestLock.current) return;
    requestLock.current = true; setBusy(true); setError('');
    try { const result = await api<DocsExampleSource>('docs/example', { signal: AbortSignal.timeout(20000) }); if (active.current) setExample(result.data); }
    catch (cause) { if (active.current) showError(cause, '无法读取示例清单。'); }
    finally { requestLock.current = false; if (active.current) setBusy(false); }
  }
  async function importExample() {
    if (!library || !example || dirty || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError(''); setMessage('');
    let imported = 0;
    try {
      // A previous request may have committed before its response was lost.
      // Start from the current saved server library; this operation only appends.
      const fresh = await api<DocsState>('docs', { signal: AbortSignal.timeout(20000) });
      let revision = fresh.etag, known = fresh.data.library;
      if (active.current) accept(fresh.data, fresh.etag);
      for (const doc of example.documents) {
        if (known.documents.some(item => item.slug === doc.slug)) continue;
        setImporting(docTitle(doc));
        const result = await api<DocsState>(`docs/import-example/${encodeURIComponent(doc.slug)}`, { method: 'POST', headers: { 'If-Match': revision }, body: '{}', signal: AbortSignal.timeout(60000) });
        revision = result.etag; known = result.data.library; imported++;
        if (active.current) accept(result.data, result.etag);
      }
      if (active.current) { setExample(null); setMessage(`已追加导入 ${imported} 篇规则，均为私有草稿；已有文档已跳过，不会覆盖。`); }
    } catch (cause) { if (active.current) showError(cause, '导入中断。已导入的草稿保留，重新打开示例导入可跳过已有文章继续。'); }
    finally { requestLock.current = false; if (active.current) { setBusy(false); setImporting(''); } }
  }
  function insertMarkdown(text: string) {
    if (!currentLibrary.current || !selectedDoc) return;
    const body = selectedDoc.body[locale] ?? '', offset = bodyInput.current?.selectionStart ?? body.length, end = bodyInput.current?.selectionEnd ?? offset;
    updateDoc({ body: { ...selectedDoc.body, [locale]: `${body.slice(0, offset)}${text}${body.slice(end)}` } });
    window.setTimeout(() => { bodyInput.current?.focus(); bodyInput.current?.setSelectionRange(offset + text.length, offset + text.length); }, 0);
  }
  async function uploadImages(files: File[]) {
    if (!selectedDoc || !library || locked || requestLock.current || !files.length) return;
    const validTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (files.some(file => !validTypes.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_SIZE)) { setError('图片仅支持 PNG、JPEG、WebP，每张须大于 0 且不超过 10 MiB。'); return; }
    if (files.length + selectedDoc.images.length > 40) { setError('每篇文档最多保存 40 张图片。'); return; }
    requestLock.current = true; setUploading('正在保存草稿…'); setError(''); setMessage('');
    const docId = selectedDoc.id, selectedLocale = locale, start = bodyInput.current?.selectionStart ?? (selectedDoc.body[locale] ?? '').length, end = bodyInput.current?.selectionEnd ?? start;
    let next = library, revision = etag, cursor = start, replaceEnd = end;
    try {
      const saved = await saveLibrary(next, revision); next = saved.data.library; revision = saved.etag;
      for (const [index, file] of files.entries()) {
        setUploading(`正在上传 ${index + 1}/${files.length}：${file.name}`);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
        const response = await api<{ asset: Asset }>(`docs/images/${docId}`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name), 'X-Image-SHA256': hash }, body: file, signal: AbortSignal.timeout(60000) });
        const asset = response.data.asset;
        const image = `\n![${file.name.replace(/[[\]\\]/g, '')}](fimel-doc-image:${asset.id})\n`;
        next = { ...next, documents: next.documents.map(doc => doc.id === docId ? { ...doc, images: [...doc.images, asset], body: { ...doc.body, [selectedLocale]: `${(doc.body[selectedLocale] ?? '').slice(0, cursor)}${image}${(doc.body[selectedLocale] ?? '').slice(replaceEnd)}` }, updatedAt: new Date().toISOString() } : doc) };
        cursor += image.length; replaceEnd = cursor;
        edit(next);
        const persisted = await saveLibrary(next, revision); next = persisted.data.library; revision = persisted.etag;
      }
      if (active.current) setMessage('图片已上传并插入正文，文档草稿已保存；发布前图片保持私有。');
    } catch (cause) { if (active.current) { edit(next); showError(cause, '上传或保存失败，当前编辑已保留。请导出草稿后核对，未公开图片不会进入官网。'); } }
    finally { requestLock.current = false; if (active.current) setUploading(''); if (fileInput.current) fileInput.current.value = ''; }
  }

  if (!library) return <section className="docs-editor">{error ? <div className="error" role="alert"><p>{error}</p><button disabled={busy} onClick={() => void load()}>重新读取文档</button></div> : <p role="status">正在读取文档中心…</p>}</section>;
  const categories = sorted(library.categories);
  const query = search.trim().toLocaleLowerCase();
  const docs = sorted(library.documents).filter(doc => (!categoryFilter || (categoryFilter === '__root__' ? !doc.categoryId : doc.categoryId === categoryFilter)) && (workflowFilter ? doc.workflow === workflowFilter : doc.workflow !== 'archived') && (!query || `${doc.slug} ${Object.values(typeof doc.title === 'string' ? { zh: doc.title } : doc.title).join(' ')} ${Object.values(doc.body).join(' ')}`.toLocaleLowerCase().includes(query)));
  const publicationLabel = (doc: DocDraft) => publicationStatus(doc, state?.published?.documents.find(item => item.id === doc.id));
  const previewImage = (id: string) => { const asset = selectedDoc?.images.find(image => image.id === id); return asset ? `/api/docs/media/${selectedDoc!.id}/${asset.id}/${encodeURIComponent(asset.name)}` : undefined; };
  const exportCurrent = () => exportJson({ library, etag, exportedAt: new Date().toISOString() }, 'fimel-docs-draft.json');
  return <section className="docs-editor" aria-label="文档中心管理">
    <div className="docs-heading"><div><h2>文档中心</h2><p>分类与文章独立保存、独立发布。私有草稿与未引用图片不会公开。</p></div><div className="button-row"><button disabled={locked} onClick={() => setManageCategories(true)}><FolderPlus size={16}/>管理分类</button><button disabled={locked || library.documents.length >= 300} onClick={() => treeRef.current?.newDocument()}><FilePlus size={16}/>新建文档</button></div></div>
    {recovery && <div className="notice"><span>发现本机未保存的文档编辑：{new Date(recovery.at).toLocaleString('zh-CN')}</span><button disabled={dirty || locked} onClick={() => { edit(recovery.library); setEtag(recovery.etag); setSelected(recovery.selected); void recoveryStore(recovery.key, 'delete').catch(() => {}); setRecovery(null); }}>恢复文档编辑</button><button disabled={locked} onClick={() => { exportJson(recovery, 'fimel-docs-recovery.json'); }}>导出恢复记录</button><button disabled={locked} onClick={() => { if (window.confirm('确定放弃这份本机文档恢复记录？')) { void recoveryStore(recovery.key, 'delete').catch(() => {}); setRecovery(null); } }}>放弃恢复记录</button></div>}
    {error && <div className="error" role="alert"><p>{error}</p>{conflict && <p>服务器版本已改变，当前输入已保留。先导出，再重新读取核对；不会自动覆盖其他管理员。</p>}<div className="button-row"><button disabled={locked} onClick={exportCurrent}>导出当前文档草稿</button><button disabled={locked} onClick={() => { if (!dirty || window.confirm('已先导出需要保留的编辑？重新读取将替换当前本机编辑。')) void load(); }}>重新读取文档</button></div></div>}
    {message && <p className="success" role="status">{message}</p>}{uploading && <p className="notice" role="status">{uploading} · 上传期间请勿关闭页面。</p>}
    <div className="docs-toolbar"><label className="search"><Search size={17}/><input aria-label="搜索文档" placeholder="搜索标题、正文或 slug" value={search} disabled={locked} onChange={event => setSearch(event.target.value)}/></label><select aria-label="筛选文档分类" value={categoryFilter} disabled={locked} onChange={event => { const value = event.target.value; setCategoryFilter(value); setContextCategory(value === '__root__' ? '' : value || null); }}><option value="">全部分类</option><option value="__root__">{ROOT_LABEL}</option>{categories.map(category => <option key={category.id} value={category.id}>{docTitle(category)}</option>)}</select><select aria-label="筛选文档状态" value={workflowFilter} disabled={locked} onChange={event => setWorkflowFilter(event.target.value)}><option value="">未归档</option>{Object.entries(workflowNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></div>
    {!!library.documents.length && <div className="docs-bulk-actions"><span>已选 {checked.size} 篇</span><div className="button-row"><button disabled={locked || !docs.length} onClick={() => setChecked(new Set(docs.map(doc => doc.id)))}>选择当前筛选文档</button><button disabled={locked || !checked.size} onClick={() => setChecked(new Set())}>清除选择</button><button disabled={locked || !checked.size} onClick={() => changeSelectedWorkflow('ready')}>所选设为待发布</button><button disabled={locked || !checked.size} onClick={() => changeSelectedWorkflow('draft')}>所选设为私有草稿</button><button disabled={locked || !checked.size} onClick={() => setArchiveReview(true)}>归档所选文档</button></div></div>}
    <div className="docs-workspace"><DocsTree ref={treeRef} actorId={actorId} categories={categories} documents={docs} allDocuments={library.documents} selected={selected} categoryFilter={categoryFilter} contextCategory={contextCategory} checked={checked} locked={locked} searching={!!query} title={item => docsLocalizedText(item.title, locale) || item.slug} status={publicationLabel} onSelect={doc => setSelected(doc.id)} onContext={setContextCategory} onCheck={(id, value) => setChecked(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); return next; })} onCreateDoc={createDoc} onCreateCategory={createCategory} onRenameDoc={renameDoc} onRenameCategory={renameCategory} onMoveDoc={moveDoc} onDeleteDoc={id => setDeleteReview({ kind: 'doc', id })} onDeleteCategory={id => setDeleteReview({ kind: 'category', id })} onCategorySettings={category => setCategoryDialog({ category: structuredClone(category), creating: false })} onCategoryOrder={reorderCategory} onMerge={category => { setMergeFrom(category.id); setMergeTo(categories.find(item => item.id !== category.id)?.id ?? ''); }}/>

    {selectedDoc ? <article className="docs-detail"><fieldset disabled={locked}><div className="docs-detail-heading"><div><h2>{docTitle(selectedDoc)}</h2><small>{savedDoc ? '稳定地址：' : '保存后地址固定：'}#/docs/{selectedDoc.slug}</small></div><span className="badge" data-testid="doc-publication-status">{publicationLabel(selectedDoc)}</span></div><div className="locale-tabs">{LOCALES.map(item => <button type="button" key={item} aria-pressed={locale === item} onClick={() => setLocale(item)}>{item === 'zh' ? '中文' : item === 'en' ? 'English' : '日本語'}</button>)}</div><div className="form-grid"><label>文档名称 · {locale}<input aria-label="文档名称" maxLength={160} value={textAt(selectedDoc.title, locale)} onChange={event => updateDoc({ title: changedText(selectedDoc.title, locale, event.target.value) })}/></label><label>稳定 slug<input aria-label="文档 slug" disabled={!!savedDoc || locked} value={selectedDoc.slug} onChange={event => updateDoc({ slug: event.target.value })}/><small>小写英文、数字与连字符，保存后固定；改名与移动分类不影响地址。</small></label><label>所属分类<select aria-label="文档所属分类" value={selectedDoc.categoryId} onChange={event => moveDoc(selectedDoc.id, event.target.value)}><option value="">{ROOT_LABEL}</option>{categories.map(category => <option key={category.id} value={category.id}>{docTitle(category)}</option>)}</select></label><label>文档状态<select aria-label="文档状态" value={selectedDoc.workflow} onChange={event => updateDoc({ workflow: event.target.value as DocDraft['workflow'] })}>{Object.entries(workflowNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><small>只有“待发布”文章会进入下一次公开发布；归档文章保留草稿与图片，可恢复。</small></label><label className="full">文档摘要 · {locale}<textarea aria-label="文档摘要" rows={2} maxLength={600} value={textAt(selectedDoc.summary, locale)} onChange={event => updateDoc({ summary: changedText(selectedDoc.summary, locale, event.target.value) })}/></label></div>
      <div className="docs-content-tools button-row"><button type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={15}/>上传正文图片</button><button type="button" onClick={() => insertMarkdown('\n:::image-left\n![图片说明](图片地址)\n\n## 小标题\n在这里填写图片右侧的说明文字。\n:::\n')}>插入图左文右</button><button type="button" onClick={() => insertMarkdown('\n:::image-right\n![图片说明](图片地址)\n\n## 小标题\n在这里填写图片左侧的说明文字。\n:::\n')}>插入文左图右</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="选择文档正文图片" onChange={event => void uploadImages(Array.from(event.target.files ?? []))}/></div><p className="hint docs-format-hint">拖入或粘贴图片直接上传；PNG / JPEG / WebP，每张 ≤10 MiB。分栏块中先写图片，空行后写文字，以 ::: 结束；手机自动上下排列。</p>
      <div className="docs-markdown-workspace"><label>Markdown 正文 · {locale}<textarea ref={bodyInput} aria-label="文档 Markdown 正文" value={selectedDoc.body[locale] ?? ''} rows={24} maxLength={120000} spellCheck={false} onChange={event => updateDoc({ body: { ...selectedDoc.body, [locale]: event.target.value } })} onDragOver={event => { if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault(); }} onDrop={event => { const files = Array.from(event.dataTransfer.files); if (files.length) { event.preventDefault(); void uploadImages(files); } }} onPaste={event => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void uploadImages(files); } }}/><small>{(selectedDoc.body[locale] ?? '').length.toLocaleString('zh-CN')} / 120,000 字符</small></label><section className="docs-rendered-preview" aria-label="官网文档效果预览"><p className="preview-label">官网效果预览 · {locale}{previewLanguageNote}</p><DocumentationBody content={previewBody} fileUrl={new URL(`https://studiofimel.com/#/docs/${selectedDoc.slug}`)} resolveImage={previewImage}/></section></div>
      {!!selectedDoc.images.length && <details className="docs-images"><summary>已上传图片（{selectedDoc.images.length}）· 点击复用，不会自动追加正文</summary><div className="docs-image-grid">{selectedDoc.images.map(asset => <div key={asset.id}><img src={previewImage(asset.id)} alt={asset.displayName ?? asset.name} loading="lazy"/><small>{asset.displayName ?? asset.name}</small><div className="button-row"><button type="button" onClick={() => insertMarkdown(`\n![${(asset.displayName ?? asset.name).replace(/[[\]\\]/g, '')}](fimel-doc-image:${asset.id})\n`)}>插入正文</button><button type="button" onClick={() => insertMarkdown(`\n:::image-left\n![图片说明](fimel-doc-image:${asset.id})\n\n在这里填写说明文字。\n:::\n`)}>图左文右</button></div></div>)}</div></details>}
      <div className="docs-document-actions button-row"><button type="button" disabled={selectedDoc.workflow === 'archived'} onClick={() => reorder(selectedDoc, -1)}><ArrowUp size={14}/>上移文档</button><button type="button" disabled={selectedDoc.workflow === 'archived'} onClick={() => reorder(selectedDoc, 1)}><ArrowDown size={14}/>下移文档</button><button type="button" onClick={() => updateDoc({ workflow: selectedDoc.workflow === 'archived' ? 'draft' : 'archived' })}><Archive size={14}/>{selectedDoc.workflow === 'archived' ? '恢复为私有草稿' : '归档文档'}</button></div></fieldset></article> : <div className="docs-detail docs-empty"><BookOpen size={32}/><h2>选择一篇文档开始编辑</h2><p>左侧选择文章，右侧同步预览官网效果。</p><button type="button" disabled={locked} onClick={() => treeRef.current?.newDocument()}>新建第一篇文档</button></div>}</div>
    <div className="publish-bar docs-publish-bar"><div><strong>{dirty ? '有未保存的文档修改' : etag === '"empty"' ? '尚无文档草稿' : '文档草稿已保存'}</strong><p>最近保存：{state?.updatedAt ? new Date(state.updatedAt).toLocaleString('zh-CN') : '尚无文章保存时间'} · 待发布 {library.documents.filter(doc => doc.workflow === 'ready').length} 篇</p></div><div className="button-row"><button disabled={locked} onClick={exportCurrent}>导出文档 JSON</button><button disabled={locked || !dirty} onClick={() => void save()}>保存文档草稿</button><button className="primary" disabled={locked || dirty || !etag || etag === '"empty"'} onClick={() => void openPreview()}>预览文档发布</button></div></div><div className="docs-example-entry"><div><h3>Fimel Card 游戏规则示例</h3><p>预览并追加导入本机整理的 23 篇规则及配图，已有 slug 自动跳过，不覆盖现有文章。</p></div><button disabled={locked || dirty} onClick={() => void previewExample()}><Upload size={15}/>预览示例导入</button></div>
    {manageCategories && <Modal title="管理文档分类" busy={locked} onClose={() => setManageCategories(false)}><p>分类别名可随时修改；非空分类须先合并或移动文章。保存草稿后再发布，官网才更新。</p><div className="docs-category-list">{categories.map((category, index) => { const count = library.documents.filter(doc => doc.categoryId === category.id).length; return <div key={category.id}><div><strong>{docTitle(category)}</strong><small>{category.slug} · {count} 篇（含归档）</small></div><div className="button-row"><button disabled={locked || index === 0} aria-label={`上移分类 ${docTitle(category)}`} onClick={() => reorderCategory(category, -1)}><ArrowUp size={14}/></button><button disabled={locked || index === categories.length - 1} aria-label={`下移分类 ${docTitle(category)}`} onClick={() => reorderCategory(category, 1)}><ArrowDown size={14}/></button><button disabled={locked} onClick={() => setCategoryDialog({ category: structuredClone(category), creating: false })}>编辑分类</button><button disabled={locked || !count || categories.length < 2} onClick={() => { setMergeFrom(category.id); setMergeTo(categories.find(item => item.id !== category.id)?.id ?? ''); }}>合并到其他分类</button><button disabled={locked || !!count} onClick={() => { setManageCategories(false); setDeleteReview({ kind: 'category', id: category.id }); }}>删除空分类</button></div></div>; })}</div><div className="button-row"><button disabled={locked || categories.length >= 50} onClick={() => { setManageCategories(false); treeRef.current?.newCategory(); }}><FolderPlus size={15}/>新建分类</button><button disabled={locked} onClick={() => setManageCategories(false)}>完成分类编辑</button></div></Modal>}
    {categoryDialog && <Modal title={categoryDialog.creating ? '新建文档分类' : '编辑文档分类'} busy={locked} onClose={() => setCategoryDialog(null)}>{error && <p className="error" role="alert">{error}</p>}<div className="form-grid docs-category-form">{LOCALES.map(item => <label key={item}>分类名称 · {item}<input aria-label={`分类名称 ${item}`} maxLength={160} value={textAt(categoryDialog.category.title, item)} onChange={event => setCategoryDialog({ ...categoryDialog, category: { ...categoryDialog.category, title: changedText(categoryDialog.category.title, item, event.target.value) } })}/></label>)}<label>分类 slug<input aria-label="分类 slug" disabled={!categoryDialog.creating && !!state?.library.categories.some(item => item.id === categoryDialog.category.id)} value={categoryDialog.category.slug} onChange={event => setCategoryDialog({ ...categoryDialog, category: { ...categoryDialog.category, slug: event.target.value } })}/></label><label className="full">分类说明 · zh<textarea aria-label="分类说明" rows={2} maxLength={600} value={textAt(categoryDialog.category.summary, 'zh')} onChange={event => setCategoryDialog({ ...categoryDialog, category: { ...categoryDialog.category, summary: changedText(categoryDialog.category.summary, 'zh', event.target.value) } })}/></label><label>关联作品 slug（可选）<input aria-label="分类关联作品" placeholder="例如 fimel-card" value={categoryDialog.category.workSlug ?? ''} onChange={event => { const category = { ...categoryDialog.category }; if (event.target.value) category.workSlug = event.target.value; else delete category.workSlug; setCategoryDialog({ ...categoryDialog, category }); }}/></label></div><div className="button-row"><button disabled={locked} onClick={() => setCategoryDialog(null)}>取消分类编辑</button><button disabled={locked} className="primary" onClick={saveCategory}>应用分类修改</button></div></Modal>}
    {mergeFrom && <Modal title="确认合并分类" busy={locked} onClose={() => setMergeFrom('')}><p>将“{docTitle(categories.find(item => item.id === mergeFrom)!)}”内的全部文档（含归档）移入目标分类，再移除原分类。文档地址不变；整项变更在一次草稿保存中完成。</p><label className="docs-merge-label">合并到<select aria-label="合并目标分类" value={mergeTo} onChange={event => setMergeTo(event.target.value)}>{categories.filter(item => item.id !== mergeFrom).map(item => <option key={item.id} value={item.id}>{docTitle(item)}</option>)}</select></label><div className="button-row"><button onClick={() => setMergeFrom('')}>取消合并</button><button className="primary" onClick={mergeCategories}>确认合并分类</button></div></Modal>}
    {archiveReview && <Modal title="确认归档所选文档" busy={locked} onClose={() => setArchiveReview(false)}><p>将归档 {checked.size} 篇文档，仍可恢复。保存草稿后需预览并确认发布，已公开的文章才会从官网下架。</p><ul className="docs-example-list">{library.documents.filter(doc => checked.has(doc.id)).map(doc => <li key={doc.id}>{docTitle(doc)}</li>)}</ul><div className="button-row"><button onClick={() => setArchiveReview(false)}>取消归档</button><button className="primary" onClick={() => changeSelectedWorkflow('archived')}>确认归档所选文档</button></div></Modal>}
    {deleteReview && <Modal title={deleteReview.kind === 'doc' ? '删除文档' : '删除分类'} busy={locked} onClose={() => setDeleteReview(null)}>{deleteReview.kind === 'doc' ? <p>删除“{docTitle(library.documents.find(doc => doc.id === deleteReview.id)!)}”会将文档归档，正文和图片保留，可在“已归档”筛选中恢复。先保存草稿，再预览并确认发布，已公开文章才会从官网下架。</p> : <p>分类“{docTitle(library.categories.find(category => category.id === deleteReview.id)!)}”包含 {library.documents.filter(doc => doc.categoryId === deleteReview.id).length} 篇文档（含归档）。{library.documents.some(doc => doc.categoryId === deleteReview.id) ? '非空分类不能直接删除。请先移动文章到其他分类或根目录，也可以合并分类。' : '此分类为空，确认后将在本机移除；保存草稿并发布后官网才更新。'}</p>}<div className="button-row"><button disabled={locked} onClick={() => setDeleteReview(null)}>取消删除</button><button className="primary" disabled={locked || deleteReview.kind === 'category' && library.documents.some(doc => doc.categoryId === deleteReview.id)} onClick={deleteItem}>{deleteReview.kind === 'doc' ? '确认删除文档' : '确认删除分类'}</button></div></Modal>}
    {preview && <Modal title="确认文档发布差异" busy={locked} onClose={() => setPreview(null)}>{error && <p className="error" role="alert">{error}</p>}<p>本次将以全部“待发布”文章替换公开文档库；私有草稿和归档文章不公开。请核对下架列表，确认后官网才更新。</p><p>分类变化：{preview.categoriesChanged ? '有，将同步公开分类名称、顺序与归属' : '无'}</p><div className="docs-publish-diff">{([['added', '新增公开'], ['changed', '修改公开'], ['removed', '从官网下架']] as [Change, string][]).map(([key, label]) => <div key={key}><h3>{label}（{preview[key].length}）</h3><ul>{preview[key].map(doc => <li key={doc.id}>{docTitle(doc)}<small>{doc.slug}</small></li>)}</ul></div>)}</div><div className="button-row"><button disabled={locked} onClick={() => setPreview(null)}>返回文档编辑</button><button disabled={locked} className="primary" onClick={() => void publish()}><Check size={16}/>{busy ? '正在发布…' : '确认发布文档'}</button></div></Modal>}
    {example && <Modal title="导入 Fimel Card 游戏规则" busy={locked} onClose={() => setExample(null)}>{error && <p className="error" role="alert">{error}</p>}<p>以下 {example.documents.length} 篇规则归入“{docTitle(example.category)}”。仅追加未存在的 slug，导入后均为私有草稿，不会自动公开。</p><ol className="docs-example-list">{example.documents.map(doc => <li key={doc.slug}><span>{docTitle(doc)}</span><small>{library.documents.some(item => item.slug === doc.slug) ? '已存在 · 跳过，不覆盖' : `将新增 · ${doc.images.length} 张图片`}</small></li>)}</ol>{importing && <p role="status">正在导入：{importing}</p>}<div className="button-row"><button disabled={locked} onClick={() => setExample(null)}>取消导入</button><button className="primary" disabled={locked || dirty || example.documents.every(doc => library.documents.some(item => item.slug === doc.slug))} onClick={() => void importExample()}>{busy ? '正在逐篇导入…' : '确认追加导入示例'}</button></div></Modal>}
  </section>;
}
