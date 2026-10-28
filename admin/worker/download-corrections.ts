import { DOWNLOAD_CORRECTIONS_KEY, parseDownloadCorrections } from '../../src/content/download-corrections';
import type { DownloadCorrection, DownloadCorrections, DownloadCorrectionState } from '../../src/content/download-corrections';
import { workEventKey } from '../../src/content/work-events';
import type { Work } from '../shared/model';
import { ApiError, EMPTY_ETAG, expectMatch, json, putJson, readJson } from './http';
import { libraryState, publicState } from './storage';

const MAX_JSON_SIZE = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export type RecordDownloadCorrection = (work: Work, before: DownloadCorrection | null, after: DownloadCorrection, reason?: string) => void;

async function registryState(bucket: R2Bucket): Promise<{ value: DownloadCorrections; etag: string }> {
  const stored = await bucket.get(DOWNLOAD_CORRECTIONS_KEY);
  if (!stored) return { value: { schemaVersion: 1, works: {} }, etag: EMPTY_ETAG };
  if (stored.size > MAX_JSON_SIZE) throw new ApiError(503, '下载量校正记录过大，未修改任何数据。');
  try { return { value: parseDownloadCorrections(await stored.json()), etag: stored.httpEtag }; }
  catch { throw new ApiError(503, '下载量校正记录损坏，未修改任何数据。'); }
}

async function eligibleWork(privateBucket: R2Bucket, publicBucket: R2Bucket, workId: string): Promise<Work> {
  const library = await libraryState(privateBucket);
  const work = library.value.works.find(item => item.id === workId);
  if (!work) throw new ApiError(404, '作品尚未保存或不存在，请先保存作品草稿。');
  if (work.workflow === 'archived') throw new ApiError(422, '已归档作品不能校正下载量。');
  const published = await publicState(publicBucket);
  const project = published.value.projects.find(item => item.slug === work.project.slug);
  if (!project) throw new ApiError(422, '作品尚未公开，请先发布作品。');
  if (project.type !== work.project.type) throw new ApiError(409, '作品的公开分类与草稿不一致，请刷新作品公开状态。');
  if (project.type === 'bedrock') throw new ApiError(422, '基岩版作品使用平台历史下载量，请在作品完整字段中修改 project.downloads。');
  return work;
}

async function todayClicks(bucket: R2Bucket, date: string, slug: string): Promise<number> {
  const stored = await bucket.get(workEventKey(date));
  if (!stored) return 0;
  if (stored.size > MAX_JSON_SIZE) throw new ApiError(503, '当日下载统计记录过大，未修改任何数据。');
  let day: unknown;
  try { day = await stored.json(); }
  catch { throw new ApiError(503, '当日下载统计记录损坏，未修改任何数据。'); }
  if (!isRecord(day) || day.date !== date || !isRecord(day.works) || Object.keys(day.works).length > 1000 ||
    Object.entries(day.works).some(([key, value]) => !/^[a-z0-9-]{1,80}$/.test(key) || !isRecord(value) ||
      ![value.views, value.downloadClicks].every(count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0))) {
    throw new ApiError(503, '当日下载统计记录损坏，未修改任何数据。');
  }
  return Object.hasOwn(day.works, slug) ? (day.works[slug] as { downloadClicks: number }).downloadClicks : 0;
}

function inputCorrection(input: unknown): { value: number; operationId: string; reason?: string } {
  if (!isRecord(input) || Object.keys(input).some(key => !['value', 'operationId', 'reason'].includes(key)) ||
    typeof input.value !== 'number' || !Number.isSafeInteger(input.value) || input.value < 0 ||
    typeof input.operationId !== 'string' || !UUID.test(input.operationId) ||
    input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 200)) {
    throw new ApiError(422, '下载量必须为非负安全整数，操作编号必须为 UUID，校正原因最多 200 字。');
  }
  return { value: input.value, operationId: input.operationId.toLowerCase(), ...(typeof input.reason === 'string' && input.reason.trim() ? { reason: input.reason.trim() } : {}) };
}

function idempotentResult(value: DownloadCorrections, slug: string, operationId: string, target: number): DownloadCorrection | undefined {
  const previous = Object.entries(value.works).find(([, entry]) => entry.operationId.toLowerCase() === operationId);
  if (!previous) return undefined;
  if (previous[0] !== slug || previous[1].value !== target) throw new ApiError(409, '此操作编号已用于其他校正，请保留输入并重新加载。');
  return previous[1];
}

export async function downloadCorrectionRoute(request: Request, privateBucket: R2Bucket, publicBucket: R2Bucket, workId: string, record?: RecordDownloadCorrection, candidate?: { value: unknown } | { error: unknown }): Promise<Response> {
  if (!['GET', 'PUT'].includes(request.method)) throw new ApiError(405, '下载量校正接口仅支持 GET / PUT。');
  const work = await eligibleWork(privateBucket, publicBucket, workId);
  const slug = work.project.slug;
  const registry = await registryState(publicBucket);
  const respond = (correction: DownloadCorrection | null, etag: string) => json({ workId, slug, correction } satisfies Omit<DownloadCorrectionState, 'etag'>, 200, etag);
  if (request.method === 'GET') return respond(Object.hasOwn(registry.value.works, slug) ? registry.value.works[slug] : null, registry.etag);
  if (candidate && 'error' in candidate) throw candidate.error;
  const input = inputCorrection(candidate ? candidate.value : await readJson(request, 4096));
  if (!request.headers.get('if-match')) throw new ApiError(428, '缺少版本条件，请重新加载下载量校正。');
  const repeated = idempotentResult(registry.value, slug, input.operationId, input.value);
  if (repeated) {
    record?.(work, repeated, repeated, input.reason);
    return respond(repeated, registry.etag);
  }
  expectMatch(request, registry.etag);
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const correction: DownloadCorrection = { value: input.value, date, anchorClicks: await todayClicks(publicBucket, date, slug), updatedAt: now, operationId: input.operationId };
  const next: DownloadCorrections = { schemaVersion: 1, works: { ...registry.value.works, [slug]: correction } };
  if (Object.keys(next.works).length > 1000 || new TextEncoder().encode(JSON.stringify(next)).byteLength > MAX_JSON_SIZE) {
    throw new ApiError(422, '下载量校正记录已达到容量上限，未修改任何数据。');
  }
  record?.(work, Object.hasOwn(registry.value.works, slug) ? registry.value.works[slug] : null, correction, input.reason);
  try {
    const saved = await putJson(publicBucket, DOWNLOAD_CORRECTIONS_KEY, next, registry.etag);
    return respond(correction, saved.httpEtag);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409) throw error;
    // The first response may have been lost, or an identical retry may have won
    // the conditional write. Never re-anchor that operation to a later click.
    const latest = await registryState(publicBucket);
    const sameOperation = idempotentResult(latest.value, slug, input.operationId, input.value);
    if (sameOperation) {
      // A competing identical request may have captured an earlier click
      // anchor. Audit the record that actually won, not this losing candidate.
      record?.(work, Object.hasOwn(registry.value.works, slug) ? registry.value.works[slug] : null, sameOperation, input.reason);
      return respond(sameOperation, latest.etag);
    }
    throw new ApiError(409, '下载量校正已被其他管理员修改，请保留输入并重新加载。');
  }
}
