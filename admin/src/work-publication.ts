import type { Library, PublicManifest, Work } from '../shared/model';
import { publicationFingerprint } from '../shared/revisions';
import { api, RequestError } from './api';

export type PublicationState = { library: Library; public: PublicManifest; publicEtag: string };
type Snapshot = { data: PublicationState; etag: string };
export type PublicationPhase = 'publishing' | 'checking';
export class PublicationUnconfirmed extends Error {
  constructor(message: string, readonly snapshot?: Snapshot) { super(message); }
}

async function boundedApi<T>(path: string, milliseconds: number, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await api<T>(path, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

// Aborting the browser request does not prove the manifest write was cancelled.
// Read the persisted fingerprint before reporting an ambiguous response as failure.
export async function publishWork(work: Work, action: 'publish' | 'unpublish', etag: string, publicEtag: string, phase: (value: PublicationPhase) => void) {
  const fingerprint = action === 'publish' ? await publicationFingerprint(work) : undefined;
  let acknowledged = false;
  phase('publishing');
  try {
    await boundedApi(`${action}/${work.id}`, 90_000, { method: 'POST', headers: { 'If-Match': etag, 'X-Public-ETag': publicEtag }, body: '{}' });
    acknowledged = true;
  } catch (cause) {
    // Explicit validation/auth/concurrency failures must retain their original message.
    if (cause instanceof RequestError && cause.status >= 400 && cause.status < 500) throw cause;
  }
  phase('checking');
  let snapshot: Snapshot;
  try { snapshot = await boundedApi<PublicationState>('library', 20_000, { cache: 'no-store' }); }
  catch {
    if (acknowledged) return { snapshot: undefined, current: true };
    throw new PublicationUnconfirmed('暂时无法确认发布结果，草稿已保存。请稍后重新读取作品，核对发布状态后再重试。');
  }
  const manifest = snapshot.data.public;
  const exists = manifest.projects.some(project => project.slug === work.project.slug);
  const current = action === 'unpublish' ? !exists : exists && manifest.publicationStates?.[work.project.slug]?.fingerprint === fingerprint;
  if (!acknowledged && !current) throw new PublicationUnconfirmed('发布结果尚未确认，草稿已保存，官网仍未显示本次修改。请稍后重新读取作品，核对状态后再重试。', snapshot);
  return { snapshot, current };
}
