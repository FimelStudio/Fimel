import { useState } from 'react';
import { ArrowUp, Download, FileArchive, Plus, Trash2 } from 'lucide-react';
import type { Locale, Release, Work } from '../shared/model';
import { releaseLabelError } from '../shared/releases';
import { ReleaseCompatibilityFields } from './ReleaseCompatibilityFields';
import { UploadPanel } from './UploadPanel';

type Props = {
  work: Work;
  locale: Locale;
  publicUrls: Record<string, string>;
  uploading: boolean;
  update(work: Work): void;
  onSave(): Promise<boolean>;
  onUploadBusy(id: string, active: boolean): void;
};

function formatSize(size: number) {
  return size < 1024 ** 2 ? `${(size / 1024).toFixed(1)} KiB` : `${(size / 1024 ** 2).toFixed(1)} MiB`;
}

export function ReleaseEditor({ work, locale, publicUrls, uploading, update, onSave, onUploadBusy }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const release = work.versions.find(version => version.id === selectedId) ?? work.versions[0];
  const patch = (changes: Partial<Release>) => update({ ...work, versions: work.versions.map(version => version.id === release.id ? { ...version, ...changes } : version) });
  const labelError = release && (releaseLabelError(release.label, release.status) || (release.label && work.versions.some(version => version.id !== release.id && version.label === release.label) ? '此版本号已存在，请为不同发行使用不同版本号。' : ''));
  const isPublic = (version: Release) => version.files.some(file => !!publicUrls[file.id]);
  const addVersion = () => {
    const next: Release = { id: crypto.randomUUID(), label: '', date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }), gameVersions: [], status: 'draft', changelog: { zh: '' }, files: [] };
    setSelectedId(next.id);
    update({ ...work, versions: [next, ...work.versions] });
  };
  return <section className="release-manager" aria-label="发行版本管理">
    <div className="section-heading">
      <div><h2>发行版本</h2><p>{work.versions.length} 个版本 · 选择版本编辑文件、兼容信息与更新日志。</p></div>
      <button type="button" disabled={uploading || work.versions.length >= 100} onClick={addVersion}><Plus size={16}/>添加版本</button>
    </div>
    <p className="release-workflow-note">保存草稿 → 上传并保存文件关联 → 发布预览 → 确认发布。草稿与文件在确认发布前均为私有。</p>
    {!release ? <div className="release-empty"><FileArchive size={28}/><h3>为这个作品添加第一个版本</h3><p>点击“添加版本”后，可以先上传文件、保存草稿，之后再补充版本信息。</p></div> : <div className="release-workspace">
      <nav className="release-list" aria-label="发行版本列表">
        {work.versions.map((version, index) => <button type="button" key={version.id} aria-current={version.id === release.id ? 'true' : undefined} disabled={uploading} onClick={() => setSelectedId(version.id)}>
          <span className="release-list-title"><strong>{version.label || '未命名版本'}</strong>{index === 0 && <span className="release-latest">最新</span>}</span>
          <span className="release-list-meta">{version.date || '未填写日期'} · {version.files.length} 个文件</span>
          <span className="release-list-status">{isPublic(version) ? '官网已有此版本' : version.status === 'draft' ? '私有草稿' : '待随作品发布'}{releaseLabelError(version.label, version.status) ? ' · 信息待修正' : ''}</span>
        </button>)}
      </nav>
      <section className="release-editor" key={release.id} aria-label="当前版本编辑">
        <div className="release-editor-heading"><div><h3>{release.label || '未命名版本'}</h3><p>{isPublic(release) ? '官网已有此版本；本次修改仍需保存并通过发布预览后才会更新。' : '当前在编辑私有草稿，保存不会直接更新官网。'}</p></div><span className="badge">{release.status === 'draft' ? '私有草稿' : '待随作品发布'}</span></div>
        <div className="form-grid release-basics">
          <label htmlFor={`release-label-${release.id}`}>版本号<input id={`release-label-${release.id}`} aria-label="版本号" value={release.label} placeholder="例如 1.0.0 或 1.21.11-v1.0" aria-invalid={!!labelError} aria-describedby={`release-label-help-${release.id}`} onChange={event => patch({ label: event.target.value })}/><small id={`release-label-help-${release.id}`} className={labelError ? 'field-error' : undefined}>{labelError || '草稿可暂时留空；发行前填写。使用英文、数字及 . _ + -，最长 80 个字符。'}</small></label>
          <label>发布日期<input type="date" value={release.date} onChange={event => patch({ date: event.target.value })}/></label>
          <label>发行状态<select aria-label="发行状态" value={release.status} onChange={event => patch({ status: event.target.value as Release['status'] })}><option value="draft">未发行（私有）</option><option value="released">已发行（随作品发布）</option></select><small>选择“已发行”后，此版本才会进入作品的发布预览；仍需确认发布。</small></label>
        </div>
        <section className="release-section" aria-label="版本文件"><div className="release-section-heading"><h3>下载文件</h3><span>{release.files.length} / 30 个文件</span></div>
          <UploadPanel workId={work.id} versionId={release.id} kind="file" onBusyChange={onUploadBusy} disabled={uploading || release.files.length >= 30} disabledHint={release.files.length >= 30 ? '此版本已达到 30 个文件上限。移除不需要的草稿关联后可以继续添加。' : '请先完成或暂停当前上传，再添加文件。'} beforeUpload={async files => {
            if (release.files.length + files.length > 30) throw new Error('每个版本最多关联 30 个文件，请减少本次选择的文件。');
            return onSave();
          }} onUploaded={asset => patch({ files: [...release.files.filter(file => file.id !== asset.id), { ...asset, primary: release.files.length === 0 }] })}/>
          {!release.files.length && <p className="hint release-no-files">尚未添加文件。可先保存空版本草稿，之后继续上传。</p>}
          {release.files.map(file => <div className="file-row release-file" key={file.id}><div><div className="release-file-name"><FileArchive size={17}/><strong>{file.displayName ?? file.name}</strong>{file.primary && <span className="badge">主下载</span>}</div><p>{formatSize(file.size)} · {file.name.split('.').pop()?.toUpperCase()} · {publicUrls[file.id] || file.publicUrl ? '已有公开文件' : '私有文件'}</p><details><summary>SHA-256 校验值</summary><code>{file.sha256}</code></details><div className="release-file-links">{file.privateKey && <a href={`/api/files/${file.id}`} download={file.displayName ?? file.name}><Download size={13}/>下载私有文件</a>}{(publicUrls[file.id] || file.publicUrl) && <a href={publicUrls[file.id] || file.publicUrl} target="_blank" rel="noopener noreferrer">查看公开文件</a>}</div></div><div className="button-row"><button type="button" disabled={uploading || !!file.primary} aria-pressed={!!file.primary} onClick={() => patch({ files: release.files.map(asset => ({ ...asset, primary: asset.id === file.id })) })}>{file.primary ? '主下载' : '设为主下载'}</button><button type="button" disabled={uploading} onClick={() => {
            if (window.confirm('移除当前草稿中的文件关联？历史文件和当前官网均保留，重新发布后才会更新官网。')) {
              const files = release.files.filter(asset => asset.id !== file.id);
              if (file.primary && files[0]) files[0] = { ...files[0], primary: true };
              patch({ files });
            }
          }}>移除</button></div></div>)}
        </section>
        <section className="release-section" aria-label="版本兼容信息"><h3>兼容信息</h3><ReleaseCompatibilityFields work={work} release={release} update={update}/></section>
        <section className="release-section"><label className="release-changelog">更新日志 · {locale}<textarea rows={7} value={typeof release.changelog === 'string' ? locale === 'zh' ? release.changelog : '' : release.changelog[locale] ?? ''} placeholder="描述这个版本的新增、修复及注意事项，支持 Markdown。" onChange={event => patch({ changelog: { ...(typeof release.changelog === 'object' ? release.changelog : { zh: release.changelog }), [locale]: event.target.value } })}/></label><p className="hint">通过上方语言按钮编辑三语更新日志。</p></section>
        <div className="release-footer"><p>已发布文件使用不可变地址；移除关联不会删除历史文件。</p><div className="button-row"><button type="button" disabled={uploading || work.versions[0].id === release.id} onClick={() => update({ ...work, versions: [release, ...work.versions.filter(version => version.id !== release.id)] })}><ArrowUp size={15}/>设为最新版本</button><button type="button" className="danger" disabled={uploading} onClick={() => {
          if (window.confirm('移除此版本的草稿关联？历史文件和已发布快照保留，当前官网不会立即改变。')) update({ ...work, versions: work.versions.filter(version => version.id !== release.id) });
        }}><Trash2 size={15}/>移除版本</button></div></div>
      </section>
    </div>}
  </section>;
}
