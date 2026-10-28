import { useEffect, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import type { Asset, Work } from '../shared/model';
import { UploadPanel, type UploadHandle } from './UploadPanel';
import './FeaturedCoverPicker.css';

type Props = { work: Work; uploading: boolean; update(work: Work): void; onSave(): Promise<boolean>; onUploadBusy(id: string, busy: boolean): void };
export function FeaturedCoverPicker({ work, uploading, update, onSave, onUploadBusy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const uploader = useRef<UploadHandle>(null);
  const latest = useRef(work);
  useEffect(() => { latest.current = work; }, [work]);
  const selected = work.gallery.find(asset => asset.id === work.featuredCoverId);
  const main = work.gallery.find(asset => asset.id === work.coverId);
  const src = (asset: Asset | undefined) => asset?.privateKey ? `/api/media/${asset.id}` : asset?.publicUrl;
  const artwork = src(selected) ?? work.project.featuredImage ?? src(main) ?? work.project.image;
  const imageUrl = artwork.startsWith('/') || artwork.startsWith('https:') ? artwork : `https://studiofimel.com/${artwork}`;
  const choose = (id?: string) => update({ ...work, featuredCoverId: id, project: { ...work.project, featuredImage: undefined } });
  return <section className="featured-cover-picker" aria-label="精选封图">
    <div className="section-heading"><div><h2>精选封图</h2><p className="hint">用于官网首页精选展示，建议横向图片。未设置时沿用作品封面，不会自动插入正文。</p></div></div>
    <div className="featured-cover-layout"><img src={imageUrl} alt="精选封图预览"/><div>
      <p className="hint">{selected ? `当前精选封图：${selected.displayName ?? selected.name}` : work.project.featuredImage ? '当前使用已有精选封图。' : '当前沿用作品封面。'}</p>
      <label>从已上传图片选择精选封图<select aria-label="选择精选封图" disabled={uploading} value={work.featuredCoverId ?? ''} onChange={event => choose(event.target.value || undefined)}>
        <option value="">{work.project.featuredImage ? '保留已有精选封图' : '沿用作品封面'}</option>
        {work.gallery.filter(asset => asset.mime.startsWith('image/')).map(asset => <option key={asset.id} value={asset.id}>{asset.displayName ?? asset.name}</option>)}
      </select></label>
      <div className="button-row"><button type="button" disabled={uploading || work.gallery.length >= 100} onClick={() => input.current?.click()}><UploadCloud size={16}/>上传精选封图</button><button type="button" disabled={uploading || !work.featuredCoverId && !work.project.featuredImage} onClick={() => choose()}>清除精选封图</button></div>
      <input hidden ref={input} aria-label="选择精选封图文件" type="file" accept=".png,.jpg,.jpeg,.webp" disabled={uploading} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void uploader.current?.start(files); }}/>
      <UploadPanel compact uploadRef={uploader} workId={work.id} kind="image" onBusyChange={onUploadBusy} beforeUpload={async () => {
        if (latest.current.gallery.length >= 100) throw new Error('候选图片已满 100 张，请先移除不需要的候选关联。');
        return onSave();
      }} onUploaded={asset => {
        const current = latest.current;
        const next = { ...current, gallery: [...current.gallery.filter(item => item.id !== asset.id), asset], featuredCoverId: asset.id, project: { ...current.project, featuredImage: undefined } };
        latest.current = next; update(next);
      }}/>
      <small>PNG / JPEG / WebP，每张不超过 10 MiB。上传前保存私有草稿；上传后请保存文件关联，再确认发布。</small>
    </div></div>
  </section>;
}
