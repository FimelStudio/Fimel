import { useEffect, useRef } from 'react';
import type { Project } from '../../src/content/projects';
import type { Work } from '../shared/model';
export function PublicationPreview({work,before,busy,onClose,onPublish}:{work:Work;before:Project|null;busy:boolean;onClose():void;onPublish():void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const current=dialog.current;current?.showModal();return ()=>current?.close();},[]);
  const after={project:work.project,markdown:work.markdown,
    gallery:work.gallery.map(a=>({name:a.name,size:a.size,cover:a.id===work.coverId})),
    versions:work.versions.filter(v=>v.status==='released').map(v=>({...v,files:v.files.map(a=>({name:a.name,size:a.size,sha256:a.sha256,primary:a.primary}))})),
  };
  return <dialog ref={dialog} className="publication-dialog modal" onCancel={onClose} aria-labelledby="preview-title"><h2 id="preview-title">发布预览</h2><p>发布当前已保存的正文、封面、截图和已发行版本。未发行版本留在私有库，安装包先校验再更新公开目录。</p><div className="diff-columns"><div><h3>当前公开元数据</h3><pre>{JSON.stringify(before,null,2)}</pre></div><div><h3>即将发布的完整内容</h3><pre>{JSON.stringify(after,null,2)}</pre></div></div><div className="button-row"><button autoFocus onClick={onClose} disabled={busy}>返回编辑</button><button className="primary" disabled={busy} onClick={onPublish}>{busy?'发布中…':'确认发布'}</button></div></dialog>;
}
