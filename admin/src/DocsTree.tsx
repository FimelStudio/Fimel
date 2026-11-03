import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight, FilePlus, FileText, Folder, FolderOpen, FolderPlus, MoreHorizontal, Move, Pencil, Trash2 } from 'lucide-react';
import type { DocsCategory } from '../../src/content/docs';
import type { DocDraft } from '../shared/docs';

export type DocsTreeHandle = { newDocument(categoryId?: string): void; newCategory(): void };
type Input = { kind: 'new-doc' | 'new-category' | 'rename-doc' | 'rename-category'; categoryId: string; id?: string; value: string };
type Menu = { kind: 'doc' | 'category'; id: string };
type Props = {
  actorId: string | null; categories: DocsCategory[]; documents: DocDraft[]; allDocuments: DocDraft[]; selected: string | null; categoryFilter: string; contextCategory: string | null;
  checked: Set<string>; locked: boolean; searching: boolean;
  title(item: { title: DocDraft['title']; slug: string }): string; status(doc: DocDraft): string;
  onSelect(doc: DocDraft): void; onContext(categoryId: string): void; onCheck(id: string, value: boolean): void;
  onCreateDoc(categoryId: string, name: string): void; onCreateCategory(name: string): void;
  onRenameDoc(id: string, name: string): void; onRenameCategory(id: string, name: string): void;
  onMoveDoc(id: string, categoryId: string): void; onDeleteDoc(id: string): void; onDeleteCategory(id: string): void;
  onCategorySettings(category: DocsCategory): void; onCategoryOrder(category: DocsCategory, direction: -1 | 1): void; onMerge(category: DocsCategory): void;
};
const MIME = 'application/x-fimel-doc-tree';
const ROOT_FILTER = '__root__';
function storedCollapsed(key: string): Set<string> {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) && value.length <= 50 && value.every(id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id)) ? new Set(value) : new Set(); } catch { return new Set(); }
}
export const DocsTree = forwardRef<DocsTreeHandle, Props>(function DocsTree(props, ref) {
  const { categories, documents, allDocuments, locked, title } = props;
  const key = `fimel-docs-folders:${props.actorId ?? 'anonymous'}`;
  const [collapsed, setCollapsed] = useState(() => storedCollapsed(key)), [input, setInput] = useState<Input | null>(null), [inputError, setInputError] = useState(''), [menu, setMenu] = useState<Menu | null>(null), [over, setOver] = useState<string | null>(null);
  const navigation = useRef<HTMLElement>(null), inputRef = useRef<HTMLInputElement>(null), menuRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const composing = useRef(false);
  const inputSession = input ? `${input.kind}:${input.id ?? ''}:${input.categoryId}` : '';
  const selectedDoc = allDocuments.find(doc => doc.id === props.selected);
  const context = props.contextCategory ?? selectedDoc?.categoryId ?? '';
  useEffect(() => { const timer = window.setTimeout(() => setCollapsed(storedCollapsed(key)), 0); return () => window.clearTimeout(timer); }, [key]);
  useEffect(() => { if (inputSession) { inputRef.current?.focus(); inputRef.current?.select(); } }, [inputSession]);
  function focusMenuButton(value: Menu) { navigation.current?.querySelector<HTMLButtonElement>(`[data-menu-kind="${value.kind}"][data-menu-id="${value.id}"]`)?.focus(); }
  function closeMenu(restore = true) { if (menu && restore) focusMenuButton(menu); setMenu(null); }
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { const trigger = navigation.current?.querySelector(`[data-menu-kind="${menu.kind}"][data-menu-id="${menu.id}"]`); if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !trigger?.contains(event.target)) { focusMenuButton(menu); setMenu(null); } };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [menu]);
  function collapse(id: string, value: boolean) {
    if (props.searching) return;
    setCollapsed(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); try { localStorage.setItem(key, JSON.stringify([...next].slice(0, 50))); } catch { /* Folding remains usable without storage. */ } return next; });
  }
  function begin(kind: Input['kind'], categoryId: string, id?: string, value = '') { if (locked || kind === 'new-doc' && allDocuments.length >= 300 || kind === 'new-category' && categories.length >= 50) return; const target = categoryId && categories.some(category => category.id === categoryId) ? categoryId : ''; composing.current = false; setMenu(null); setInputError(''); setInput({ kind, categoryId: target, id, value }); if (target) collapse(target, false); props.onContext(target); }
  useImperativeHandle(ref, () => ({ newDocument(categoryId = context) { begin('new-doc', categoryId); }, newCategory() { begin('new-category', ''); } }));
  function finish() {
    if (!input || locked || composing.current) return;
    const name = input.value.trim(); if (!name) { setInputError('请输入名称，再按 Enter 确认。'); return; }
    if (input.kind === 'new-doc') props.onCreateDoc(input.categoryId, name);
    else if (input.kind === 'new-category') props.onCreateCategory(name);
    else if (input.kind === 'rename-doc') props.onRenameDoc(input.id!, name);
    else props.onRenameCategory(input.id!, name);
    composing.current = false; setInput(null); setInputError('');
  }
  function inline(value: Input) {
    return <form className="docs-tree-input" onSubmit={event => { event.preventDefault(); finish(); }}>
      {value.kind.includes('category') ? <Folder size={16}/> : <FileText size={15}/>}
      <div><input ref={inputRef} aria-label={value.kind.startsWith('new') ? value.kind === 'new-doc' ? '新文档名称' : '新分类名称' : '重命名'} maxLength={160} value={value.value} disabled={locked} placeholder={value.kind.includes('category') ? '分类名称' : '文档名称'} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onChange={event => { setInput({ ...value, value: event.target.value }); setInputError(''); }} onKeyDown={event => { const ime = composing.current || event.nativeEvent.isComposing || event.keyCode === 229; if (ime && ['Enter', 'Escape'].includes(event.key)) { if (event.key === 'Enter') event.preventDefault(); event.stopPropagation(); } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); composing.current = false; setInput(null); setInputError(''); } }}/><small>{inputError || 'Enter 确认 · Esc 取消'}</small></div>
    </form>;
  }
  function rowKeys(event: KeyboardEvent, value: Menu, categoryId: string) {
    if (event.target instanceof HTMLElement && event.target.matches('input,textarea,select')) return;
    if (event.key === 'F2') { event.preventDefault(); if (value.kind === 'doc') { const doc = allDocuments.find(item => item.id === value.id); if (doc) begin('rename-doc', categoryId, doc.id, title(doc)); } else { const category = categories.find(item => item.id === value.id); if (category) begin('rename-category', category.id, category.id, title(category)); } }
    else if (event.key === 'Delete') { event.preventDefault(); if (!locked) { if (value.kind === 'doc') props.onDeleteDoc(value.id); else props.onDeleteCategory(value.id); } }
    else if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); if (!locked) setMenu(value); }
    else if (value.kind === 'category' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); collapse(value.id, event.key === 'ArrowLeft'); }
  }
  function drop(event: DragEvent, categoryId: string) {
    if (locked || !event.dataTransfer.types.includes(MIME)) return;
    event.preventDefault(); event.stopPropagation(); setOver(null);
    const id = event.dataTransfer.getData(MIME);
    if (!id || id !== dragging.current || !allDocuments.some(doc => doc.id === id) || categoryId && !categories.some(category => category.id === categoryId)) return;
    props.onMoveDoc(id, categoryId); if (categoryId) collapse(categoryId, false); props.onContext(categoryId); dragging.current = null;
  }
  function dragOver(event: DragEvent, categoryId: string) { if (!locked && dragging.current && event.dataTransfer.types.includes(MIME)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setOver(categoryId); } }
  function openMenu(value: Menu) { if (locked) return; composing.current = false; setInput(null); setMenu(current => current?.id === value.id && current.kind === value.kind ? null : value); }
  function menuButtons(value: Menu) {
    if (menu?.id !== value.id || menu.kind !== value.kind) return null;
    const doc = value.kind === 'doc' ? allDocuments.find(item => item.id === value.id) : undefined;
    const category = value.kind === 'category' ? categories.find(item => item.id === value.id) : undefined;
    const run = (action: () => void) => { closeMenu(false); action(); };
    return <div ref={menuRef} className="docs-tree-menu" role="menu" aria-label={doc ? `文档操作 ${title(doc)}` : `分类操作 ${title(category!)}`} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[target]?.focus(); }
    }}>
      {doc ? <><button type="button" role="menuitem" onClick={() => run(() => begin('rename-doc', doc.categoryId, doc.id, title(doc)))}><Pencil size={14}/>重命名文档 <kbd>F2</kbd></button><button type="button" role="menuitem" disabled={!doc.categoryId} onClick={() => run(() => props.onMoveDoc(doc.id, ''))}><Move size={14}/>移到根目录</button><button type="button" role="menuitem" onClick={() => run(() => props.onDeleteDoc(doc.id))}><Trash2 size={14}/>删除文档（可恢复） <kbd>Del</kbd></button></> : category ? <><button type="button" role="menuitem" disabled={allDocuments.length >= 300} onClick={() => run(() => begin('new-doc', category.id))}><FilePlus size={14}/>在此新建文档</button><button type="button" role="menuitem" onClick={() => run(() => begin('rename-category', category.id, category.id, title(category)))}><Pencil size={14}/>重命名分类 <kbd>F2</kbd></button><button type="button" role="menuitem" onClick={() => run(() => props.onCategorySettings(category))}>分类设置</button><button type="button" role="menuitem" disabled={categories[0]?.id === category.id} onClick={() => run(() => props.onCategoryOrder(category, -1))}>上移分类</button><button type="button" role="menuitem" disabled={categories.at(-1)?.id === category.id} onClick={() => run(() => props.onCategoryOrder(category, 1))}>下移分类</button><button type="button" role="menuitem" disabled={categories.length < 2} onClick={() => run(() => props.onMerge(category))}>合并到其他分类</button><button type="button" role="menuitem" onClick={() => run(() => props.onDeleteCategory(category.id))}><Trash2 size={14}/>删除分类 <kbd>Del</kbd></button></> : null}
    </div>;
  }
  function file(doc: DocDraft, nested: boolean) {
    const value: Menu = { kind: 'doc', id: doc.id };
    return <li key={doc.id} className={`docs-tree-file ${nested ? 'nested' : ''}`}>
      <div className="docs-list-row" draggable={!locked && !input} onDragStart={event => { if (locked || input) { event.preventDefault(); return; } dragging.current = doc.id; event.dataTransfer.setData(MIME, doc.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragging.current = null; setOver(null); }} onKeyDown={event => rowKeys(event, value, doc.categoryId)} onContextMenu={event => { event.preventDefault(); props.onContext(doc.categoryId); openMenu(value); }}>
        <input type="checkbox" aria-label={`选择文档 ${title(doc)}`} disabled={locked} checked={props.checked.has(doc.id)} onChange={event => props.onCheck(doc.id, event.target.checked)}/>
        {input?.kind === 'rename-doc' && input.id === doc.id ? inline(input) : <button type="button" className={`docs-file-open ${props.selected === doc.id ? 'active' : ''}`} disabled={locked} aria-current={props.selected === doc.id ? 'page' : undefined} onClick={() => { props.onContext(doc.categoryId); props.onSelect(doc); }}><FileText size={15}/><span><strong>{title(doc)}</strong><small>{props.status(doc)}</small></span></button>}
        <button type="button" className="docs-tree-more" aria-label={`文档操作 ${title(doc)}`} aria-haspopup="menu" aria-expanded={menu?.id === doc.id && menu.kind === 'doc'} data-menu-kind="doc" data-menu-id={doc.id} disabled={locked} onClick={() => openMenu(value)}><MoreHorizontal size={16}/></button>
      </div>{menuButtons(value)}
    </li>;
  }
  return <nav ref={navigation} className="docs-list docs-tree" aria-label="文档树" onDragOver={event => { if (event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes(MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'none'; } }} onDrop={event => { if (event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes(MIME)) { event.preventDefault(); event.stopPropagation(); } }}>
    <div className={`docs-tree-root ${over === '' ? 'drag-over' : ''}`} data-testid="docs-root-drop" onDragOver={event => dragOver(event, '')} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOver(null); }} onDrop={event => drop(event, '')}>
      <button type="button" className={context === '' ? 'active' : ''} disabled={locked} onClick={() => props.onContext('')}><FolderOpen size={16}/><span>文档根目录</span></button>
      <button type="button" aria-label="在根目录新建文档" title="在根目录新建文档" disabled={locked || allDocuments.length >= 300} onClick={() => begin('new-doc', '')}><FilePlus size={16}/></button>
      <button type="button" aria-label="在文档树新建分类" title="新建分类" disabled={locked || categories.length >= 50} onClick={() => begin('new-category', '')}><FolderPlus size={16}/></button>
    </div><p>{documents.length} 篇文档 · {categories.length} 个分类</p>
    <ul className="docs-tree-items">
      {input?.kind === 'new-category' && <li>{inline(input)}</li>}
      {input?.kind === 'new-doc' && !input.categoryId && <li>{inline(input)}</li>}
      {documents.filter(doc => !doc.categoryId).map(doc => file(doc, false))}
      {props.categoryFilter !== ROOT_FILTER && categories.filter(category => !props.categoryFilter || props.categoryFilter === category.id).map(category => {
        const children = documents.filter(doc => doc.categoryId === category.id), expanded = props.searching || !collapsed.has(category.id), value: Menu = { kind: 'category', id: category.id };
        return <li key={category.id} className={`docs-tree-folder ${over === category.id ? 'drag-over' : ''}`} data-category-id={category.id} onDragOver={event => dragOver(event, category.id)} onDrop={event => drop(event, category.id)} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOver(null); }}>
          <div className="docs-tree-folder-row" onKeyDown={event => rowKeys(event, value, category.id)} onContextMenu={event => { event.preventDefault(); props.onContext(category.id); openMenu(value); }}>
            {input?.kind === 'rename-category' && input.id === category.id ? inline(input) : <button type="button" className={`docs-tree-folder-toggle ${context === category.id ? 'active' : ''}`} disabled={locked} aria-label={`${expanded ? '收起' : '展开'}分类 ${title(category)}`} aria-expanded={expanded} aria-controls={`docs-folder-children-${category.id}`} onClick={() => { props.onContext(category.id); collapse(category.id, expanded); }}>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} {expanded ? <FolderOpen size={16}/> : <Folder size={16}/>}<strong>{title(category)}</strong><small title={`含已归档共 ${allDocuments.filter(doc => doc.categoryId === category.id).length} 篇`}>{children.length}</small></button>}
            <button type="button" className="docs-tree-more" aria-label={`分类操作 ${title(category)}`} aria-haspopup="menu" aria-expanded={menu?.id === category.id && menu.kind === 'category'} data-menu-kind="category" data-menu-id={category.id} disabled={locked} onClick={() => openMenu(value)}><MoreHorizontal size={16}/></button>
          </div>{menuButtons(value)}
          <ul id={`docs-folder-children-${category.id}`} hidden={!expanded}>{input?.kind === 'new-doc' && input.categoryId === category.id && <li className="nested">{inline(input)}</li>}{children.map(doc => file(doc, true))}{!children.length && !(input?.kind === 'new-doc' && input.categoryId === category.id) && <li className="docs-tree-folder-empty"><button type="button" disabled={locked || allDocuments.length >= 300} onClick={() => begin('new-doc', category.id)}>在此新建文档</button></li>}</ul>
        </li>;
      })}
    </ul>{!documents.length && !categories.length && !input && <p className="docs-tree-empty">根目录可以直接放文档，也可以新建分类后整理。</p>}
    <p className="docs-tree-help">F2 重命名 · Delete 删除 · 拖动文件到分类或根目录；也可在右侧“所属分类”中移动。</p>
  </nav>;
});
