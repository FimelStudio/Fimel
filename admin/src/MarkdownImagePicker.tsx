import { useState } from 'react';
import type { Asset } from '../shared/model';
import { imageMarkdown } from '../shared/markdown';

export function MarkdownImagePicker({ assets, onInsert, onClose }: {
  assets: Asset[]; onInsert(markdown: string): void; onClose(): void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return <section className="markdown-image-picker" aria-label="插入正文图片">
    <div className="section-heading"><div><h3>选择正文图片</h3><p>选择一张插入图片，选择多张组成轮播。插入当前语言、当前正文的光标位置。</p></div><button onClick={onClose}>收起</button></div>
    {assets.length ? <><div className="gallery-grid">{assets.map(asset => <label key={asset.id}>
      <img src={asset.privateKey ? `/api/media/${asset.id}` : asset.publicUrl} alt="" />
      <span><input type="checkbox" checked={selected.includes(asset.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, asset.id] : previous.filter(id => id !== asset.id))} />{asset.displayName ?? asset.name}</span>
    </label>)}</div><button className="primary" disabled={!selected.length} onClick={() => {
      const ordered = selected.map(id => assets.find(asset => asset.id === id)!);
      onInsert(ordered.map(asset => imageMarkdown(asset)).join('\n'));onClose();
    }}>{selected.length > 1 ? `插入轮播（${selected.length} 张）` : '插入图片'}</button></> : <p>还没有上传图片。可直接拖入或粘贴到正文，也可使用“上传图片”。<button onClick={onClose}>返回正文上传</button></p>}
  </section>;
}
