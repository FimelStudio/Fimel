import { useEffect, useRef } from 'react';
import { localizedText } from '../../src/content/projects';
import type { ImportPlan } from '../shared/import';

export function ImportPreview({plan,source,onClose,onApply}:{plan:ImportPlan;source:string;onClose():void;onApply():void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const current=dialog.current;current?.showModal();return()=>current?.close();},[]);
  return <dialog ref={dialog} className="publication-dialog modal import-dialog" onCancel={onClose} aria-labelledby="import-title">
    <h2 id="import-title">导入作品预览</h2><p>{source} · 新增 {plan.added.length} 个作品 · 已有 {plan.skipped.length} 个作品保留当前内容。</p>
    <p className="hint">仅将新作品合并到编辑区，不删除或覆盖已有作品。检查后点击“保存草稿”写入私有库；保存时自动备份，作品不会自动公开。</p>
    {!!plan.added.length&&<div className="report-table"><table><thead><tr><th>新增作品</th><th>slug</th><th>语言</th></tr></thead><tbody>{plan.added.map(work=><tr key={work.id}><td>{localizedText(work.project.title,'zh')}</td><td>{work.project.slug}</td><td>{Object.keys(work.markdown.description).join(' / ')}</td></tr>)}</tbody></table></div>}
    {!!plan.skipped.length&&<details><summary>查看保留的已有作品（{plan.skipped.length}）</summary><ul>{plan.skipped.map(work=><li key={work.id}>{localizedText(work.project.title,'zh')} · {work.project.slug}</li>)}</ul></details>}
    <div className="button-row"><button autoFocus onClick={onClose}>取消</button><button className="primary" disabled={!plan.added.length} onClick={onApply}>合并到编辑区</button></div>
  </dialog>;
}
