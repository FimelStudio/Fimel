import { useEffect, useRef } from 'react';
import type { Work } from '../shared/model';
import type { WorkConflict } from '../shared/revisions';
import { mergeWork } from '../shared/revisions';
export function ConflictReview({ conflict, resolve, close }: { conflict: WorkConflict; resolve(work: Work, current: Work | null): void; close(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const at = (value: unknown, path: string) => path.split('.').reduce<unknown>((node, key) => node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined, value);
  const display = (value: unknown) => value === undefined ? '未设置' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <dialog ref={dialog} className="publication-dialog modal" onCancel={close} aria-labelledby="conflict-title"><h2 id="conflict-title">此作品存在编辑冲突</h2><p>修改不会自动覆盖。未冲突字段会合并保留；选择冲突字段后仍需再次保存草稿。</p>
    <div className="report-table"><table><thead><tr><th>字段</th><th>你开始编辑时</th><th>当前服务器内容</th><th>你的修改</th></tr></thead><tbody>{conflict.paths.map(path => <tr key={path}><th>{path}</th><td><pre>{display(at(conflict.base, path))}</pre></td><td><pre>{display(at(conflict.current, path))}</pre></td><td><pre>{display(at(conflict.incoming, path))}</pre></td></tr>)}</tbody></table></div>
    <div className="button-row"><button autoFocus onClick={close}>保留编辑，稍后处理</button>{conflict.current && <button onClick={() => resolve(conflict.current!, conflict.current)}>使用服务器版本</button>}{conflict.current && conflict.base && <button onClick={() => resolve(mergeWork(conflict.base!, conflict.current!, conflict.incoming).work, conflict.current)}>保留我的冲突字段，继续编辑</button>}</div>
  </dialog>;
}
