import { useEffect, useRef, useState } from 'react';
import { MAX_IMAGE_SIZE } from '../shared/model';
import type { Asset, Locale, Work } from '../shared/model';
import type { ProjectTab } from '../../src/content/projects';
import { imageMarkdown } from '../shared/markdown';
import { matchLocalImages } from '../shared/image-import';
import { MAX_SVG_SIZE, validateSvg } from '../shared/svg';
import type { UploadHandle } from './UploadPanel';

export function transferFiles(transfer: DataTransfer | null | undefined) {
  if (!transfer) return [];
  if (transfer.files.length) return Array.from(transfer.files);
  return Array.from(transfer.items).filter(item => item.kind === 'file').flatMap(item => {
    const file = item.getAsFile();return file ? [file] : [];
  });
}

type Insertion = { tab: ProjectTab; locale: Locale; start: number; end: number; selected: string; last: string | null; matched: Set<string> };
export function useMarkdownImages({ work, saved, tab, locale, update, onSave }: {
  work: Work; saved: boolean; tab: ProjectTab; locale: Locale; update(work: Work): void; onSave(): Promise<boolean>;
}) {
  const uploadRef = useRef<UploadHandle>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(work);const insertion = useRef<Insertion | null>(null);const starting = useRef(false);
  const [error, setError] = useState('');const [preparing, setPreparing] = useState(false);
  useEffect(() => { latest.current = work; }, [work]);

  async function importFiles(files: File[]) {
    if (!files.length || starting.current) return;
    setError('');
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    files = files.map(file => !file.name.includes('.') && extensions[file.type]
      ? new File([file], `${file.name || 'image'}.${extensions[file.type]}`, { type: file.type }) : file);
    if (files.some(file => !/\.(png|jpe?g|webp|svg)$/i.test(file.name) || file.size < 1 || file.size > (/\.svg$/i.test(file.name) ? MAX_SVG_SIZE : MAX_IMAGE_SIZE))) {
      setError('正文图片仅支持 PNG、JPEG、WebP（≤10 MiB）和静态 SVG（≤1 MiB）。原有正文没有更改。');return;
    }
    const start = textRef.current?.selectionStart ?? (work.markdown[tab][locale] ?? '').length;
    const end = textRef.current?.selectionEnd ?? start;
    starting.current = true;setPreparing(true);
    try {
      const matched = new Set<string>();
      for (const file of files) {
        if (matchLocalImages(latest.current.markdown[tab][locale] ?? '', file.name, 'placeholder').matched) matched.add(file.name);
        if (/\.svg$/i.test(file.name)) validateSvg(new Uint8Array(await file.arrayBuffer()));
      }
      if (!saved && !await onSave()) { setError('请先填写作品名称和稳定 slug 并保存草稿，再导入图片。');return; }
      const text = latest.current.markdown[tab][locale] ?? '';
      insertion.current = { tab, locale, start, end, selected: text.slice(start, end), last: null, matched };
      await uploadRef.current?.start(files);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '图片导入失败，原正文已保留。');
    } finally { starting.current = false;setPreparing(false); }
  }

  function onUploaded(asset: Asset) {
    const current = latest.current;const target = insertion.current;
    if (!target) return;
    const text = current.markdown[target.tab][target.locale] ?? '';
    const markup = imageMarkdown(asset);let value: string;
    const matched = matchLocalImages(text, asset.displayName ?? asset.name, `fimel-asset:${asset.id}`);
    const previous = target.last ? text.indexOf(target.last) : -1;
    if (matched.matched) {
      value = matched.content; target.start += matched.shift(target.start); target.end += matched.shift(target.end);
    } else if (target.matched.has(asset.displayName ?? asset.name)) {
      // The author deleted its placeholder during upload: keep the asset, never resurrect it.
      value = text;
    } else if (previous >= 0 && target.last) {
      const cursor = previous + target.last.length;value = `${text.slice(0, cursor)}\n${markup}${text.slice(cursor)}`;
    } else {
      const start = Math.min(target.start, text.length);
      // A paused upload must never replace text the administrator has edited meanwhile.
      const end = text.slice(start, target.end) === target.selected ? target.end : start;
      value = `${text.slice(0, start)}\n\n${markup}\n\n${text.slice(end)}`;
    }
    if (!matched.matched && !target.matched.has(asset.displayName ?? asset.name)) target.last = markup;
    const next = { ...current, gallery: [...current.gallery.filter(item => item.id !== asset.id), asset],
      markdown: { ...current.markdown, [target.tab]: { ...current.markdown[target.tab], [target.locale]: value } },
    };
    latest.current = next;update(next);
  }

  return { uploadRef, textRef, inputRef, importFiles, onUploaded, error, preparing };
}
