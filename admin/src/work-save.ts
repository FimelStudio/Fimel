import type { Library, PublicManifest, Work } from '../shared/model';
import { mergeWork, sameWorkContent } from '../shared/revisions';
import { api, RequestError } from './api';

export type SavePhase = 'saving' | 'checking';
export type SavedSnapshot = { library: Library; public: PublicManifest; publicEtag: string };
export class SaveUnconfirmed extends Error {}

// Server timestamps change on a successful save. All content, identifiers and
// asset metadata must still match; do not equate equal lengths with equal text.
export function savedChangesPresent(base: Work | null, incoming: Work, current: Work | undefined): boolean {
  if (!current) return false;
  if (sameWorkContent(current, incoming)) return true;
  if (!base) return false;
  const merged = mergeWork(base, current, incoming);
  return merged.conflicts.length === 0 && sameWorkContent(merged.work, current);
}

export async function saveWorkDraft(base: Work | null, work: Work, phase: (value: SavePhase) => void) {
  phase('saving');
  try {
    return await api<SavedSnapshot>(`works/${work.id}`, { method: 'PUT', body: JSON.stringify({ base, work }) }, 30_000);
  } catch (cause) {
    // A known validation/auth/conflict rejection has not saved this request.
    if (cause instanceof RequestError && cause.status >= 400 && cause.status < 500) throw cause;
  }
  phase('checking');
  try {
    const result = await api<SavedSnapshot>('library', { cache: 'no-store' }, 15_000);
    if (savedChangesPresent(base, work, result.data.library.works.find(value => value.id === work.id))) return result;
  } catch { /* Keep the editing base intact when a read cannot confirm the write. */ }
  throw new SaveUnconfirmed('暂时无法确认草稿保存结果，当前编辑已保留。请先导出当前修改，再稍后重试保存；系统会核对服务器版本，不会自动覆盖其他人的修改。');
}
