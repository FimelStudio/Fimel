import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, RefreshCw } from 'lucide-react';
import type { DownloadCorrectionState } from '../../src/content/download-corrections';
import { readWorkDownloadTotals } from '../../src/lib/work-downloads';
import { api, RequestError } from './api';
import './DownloadCorrection.css';

type Props = {
  workId: string;
  slug: string;
  title: string;
  eligible: boolean;
  saved: boolean;
  archived: boolean;
  blocked: boolean;
  onBusyChange(busy: boolean): void;
  onDirtyChange(dirty: boolean): void;
};
type Pending = { value: number; operationId: string; reason?: string; etag: string };

/** A separate statistics operation: never changes or saves the edited work. */
export function DownloadCorrection({ workId, slug, title, eligible, saved, archived, blocked, onBusyChange, onDirtyChange }: Props) {
  const [state, setState] = useState<DownloadCorrectionState | null>(null);
  const [current, setCurrent] = useState<number | null | undefined>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stale, setStale] = useState(false);
  const [review, setReview] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const active = useRef(true);
  const reading = useRef<AbortController | null>(null);
  const pending = useRef<Pending | null>(null);
  const draft = useRef({ value: '', reason: '' });
  const sending = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const canCorrect = saved && eligible && !archived;
  const target = /^\d+$/.test(value) ? Number(value) : NaN;
  const valid = Number.isSafeInteger(target) && target >= 0;
  const dirty = value !== '' || reason !== '';
  const invalid = (value !== '' || attempted) && !valid;

  const read = useCallback(async () => {
    reading.current?.abort();
    const controller = new AbortController(); reading.current = controller;
    setLoading(true); setError(''); setCurrent(undefined); setState(null);
    try {
      const [correction, totals] = await Promise.all([
        api<DownloadCorrectionState>(`download-corrections/${workId}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }),
        readWorkDownloadTotals('/api/work-downloads', (url, options) => fetch(url, {
          ...options, credentials: 'same-origin', headers: { 'X-Fimel-CSRF': '1' },
          signal: AbortSignal.any([controller.signal, options.signal]),
        })),
      ]);
      if (controller.signal.aborted || !active.current) return;
      if (correction.data.workId !== workId || correction.data.slug !== slug || !correction.etag || !Object.hasOwn(totals.works, slug)) {
        throw new Error('作品公开状态已改变，请刷新作品库后再校正。');
      }
      setState({ ...correction.data, etag: correction.etag });
      setCurrent(totals.works[slug].downloadClicks);
      setStale(false);
      if (pending.current && correction.data.correction?.operationId === pending.current.operationId) {
        const confirmed = pending.current;
        const unchanged = /^\d+$/.test(draft.current.value) && Number(draft.current.value) === confirmed.value && (draft.current.reason.trim() || undefined) === confirmed.reason;
        if (unchanged) {
          setValue(''); setReason(''); setAttempted(false);
        }
        pending.current = null;
        setMessage(unchanged ? '已确认上次校正成功。后续真实点击会继续累加，刷新官网可查看。' : '已确认上次校正成功。当前的新输入尚未应用，请核对后另行确认。');
      }
    } catch (cause) {
      if (!controller.signal.aborted && active.current) setError(cause instanceof Error ? cause.message : '无法读取当前下载数，请稍后重试。');
    } finally {
      if (!controller.signal.aborted && active.current) setLoading(false);
    }
  }, [workId, slug]);

  useEffect(() => {
    active.current = true;
    const timer = canCorrect ? window.setTimeout(() => void read(), 0) : undefined;
    return () => { active.current = false; window.clearTimeout(timer); reading.current?.abort(); onBusyChange(false); onDirtyChange(false); };
  }, [canCorrect, read, onBusyChange, onDirtyChange]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { draft.current = { value, reason }; }, [value, reason]);
  useEffect(() => { if (review) dialog.current?.showModal(); }, [review]);

  function reset() { setValue(''); setReason(''); setAttempted(false); pending.current = null; }
  async function submit() {
    if (!state || !valid || stale || blocked || sending.current) return;
    sending.current = true; setSubmitting(true); onBusyChange(true); setError(''); setMessage('');
    const note = reason.trim() || undefined;
    const previous = pending.current;
    const operation = previous && previous.value === target && previous.reason === note && previous.etag === state.etag
      ? previous : { value: target, operationId: crypto.randomUUID(), reason: note, etag: state.etag };
    pending.current = operation;
    try {
      const response = await api<DownloadCorrectionState>(`download-corrections/${workId}`, {
        method: 'PUT', headers: { 'If-Match': operation.etag },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ value: operation.value, operationId: operation.operationId, ...(operation.reason ? { reason: operation.reason } : {}) }),
      });
      if (!active.current) return;
      setState({ ...response.data, etag: response.etag });
      reset();
      setMessage('下载数已校正。后续真实点击会继续累加，刷新官网可查看；作品草稿与正文未被保存或重新发布。');
      await read();
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof RequestError && cause.status === 409) {
        pending.current = null; setStale(true);
        setError('下载数校正状态已改变，输入已保留。请点击“重新读取下载数”，核对后再次确认；不会覆盖其他管理员的修改。');
      } else if (cause instanceof RequestError && cause.status >= 400 && cause.status < 500) {
        pending.current = null; setError(cause.message);
      } else {
        setError('本次校正结果尚未确认，输入已保留。可再次确认重试同一操作，或重新读取下载数核对结果；重试不会重复校正。');
      }
    } finally {
      sending.current = false;
      if (active.current) { setSubmitting(false); setReview(false); onBusyChange(false); }
    }
  }

  return <section className="download-correction" aria-labelledby={`${id}-title`}>
    <div className="section-heading"><div><h2 id={`${id}-title`}><Download size={18}/>校正下载数</h2><p>独立修改统计，确认后直接更新官网，无需重新发布作品。</p></div>{canCorrect && <button type="button" disabled={loading || submitting || blocked} onClick={() => void read()}><RefreshCw size={15}/>{loading ? '正在读取' : '重新读取下载数'}</button>}</div>
    {!canCorrect ? <p className="hint">{!saved ? '请先保存并公开作品，再校正下载数。' : archived ? '已归档作品不能校正下载数。' : '作品尚未公开，请先发布作品，再校正下载数。'}</p> : <>
      <div className="download-correction-current"><span>当前官网显示</span><strong data-testid="current-download-count">{loading ? '正在读取…' : current === undefined ? '读取失败' : current === null ? '暂无采集记录' : current.toLocaleString('zh-CN')}</strong>{state?.correction && <small>上次校正：{new Date(state.correction.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</small>}</div>
      <div className="download-correction-fields"><label htmlFor={`${id}-value`}>希望显示的下载数<input id={`${id}-value`} aria-label="希望显示的下载数" inputMode="numeric" autoComplete="off" placeholder="输入非负整数，如 5000" value={value} disabled={submitting || blocked} aria-invalid={invalid} aria-describedby={`${id}-help`} onChange={event => { setValue(event.target.value); setMessage(''); }}/><small id={`${id}-help`} className={invalid ? 'field-error' : undefined}>{invalid ? '请输入 0 至 9007199254740991 之间的整数，不支持负数、小数或科学计数法。' : '输入 0 后官网会隐藏下载数；之后的新点击仍会继续累加。'}</small></label><label htmlFor={`${id}-reason`}>校正原因（可选）<input id={`${id}-reason`} aria-label="校正原因" maxLength={200} value={reason} disabled={submitting || blocked} placeholder="如：补录历史下载量" onChange={event => setReason(event.target.value)}/><small>仅在管理员日志中保存，不公开展示。</small></label></div>
      <div className="button-row"><button type="button" disabled={loading || submitting || blocked || !state || stale} onClick={() => { setAttempted(true); if (valid) setReview(true); }}>校正下载数</button>{dirty && <button type="button" disabled={submitting || blocked} onClick={reset}>清空校正输入</button>}</div>
      {dirty && <p className="hint download-correction-pending">下载数尚未确认修改；“保存草稿”不会提交这里的校正。</p>}
      <p className="hint download-correction-note">原始每日采集记录保留，访问与下载统计报表不受校正影响。每次校正均记录操作者与修改内容。</p>
      {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    </>}
    {review && createPortal(<div className="admin-shell download-correction-portal"><dialog ref={dialog} className="publication-dialog modal download-correction-dialog" aria-labelledby={`${id}-confirm-title`} onCancel={event => { if (submitting) event.preventDefault(); else setReview(false); }}>
      <h2 id={`${id}-confirm-title`}>确认校正下载数</h2><p><strong>{title || slug}</strong> · {slug}</p>
      <dl><div><dt>当前官网显示</dt><dd>{current === null ? '暂无采集记录' : current?.toLocaleString('zh-CN') ?? '读取失败'}</dd></div><div><dt>校正为</dt><dd>{target.toLocaleString('zh-CN')}{target === 0 ? '（官网隐藏）' : ''}</dd></div></dl>
      {reason.trim() && <p>校正原因：{reason.trim()}</p>}
      <p>确认后直接修改官网统计，后续新点击继续累加。真实采集记录保留；本次不会保存或发布作品内容。</p>
      <div className="button-row"><button type="button" autoFocus disabled={submitting} onClick={() => setReview(false)}>取消</button><button type="button" className="primary" disabled={submitting} onClick={() => void submit()}>{submitting ? '正在校正…' : '确认修改下载数'}</button></div>
    </dialog></div>, document.body)}
  </section>;
}
