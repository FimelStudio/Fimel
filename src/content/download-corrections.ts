/** A correction resets the display baseline without editing collected daily events. */
export const DOWNLOAD_CORRECTIONS_KEY = 'metrics/download-corrections.json';

export type DownloadCorrection = {
  value: number;
  date: string;
  anchorClicks: number;
  updatedAt: string;
  operationId: string;
};
export type DownloadCorrections = {schemaVersion: 1; works: Record<string, DownloadCorrection>};
export type DownloadCorrectionState = {workId: string; slug: string; correction: DownloadCorrection | null; etag: string};

const slugPattern = /^[a-z0-9-]{1,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

/** Reject corrupt registries rather than silently replacing a correction with raw counts. */
export function parseDownloadCorrections(value: unknown): DownloadCorrections {
  if (!record(value) || value.schemaVersion !== 1 || Object.keys(value).some(key => !['schemaVersion', 'works'].includes(key)) ||
    !record(value.works) || Object.keys(value.works).length > 1000) throw Error('Invalid download corrections.');
  const works: Record<string, DownloadCorrection> = {};
  for (const [slug, correction] of Object.entries(value.works)) {
    if (!slugPattern.test(slug) || !record(correction) || Object.keys(correction).length !== 5 ||
      Object.keys(correction).some(key => !['value', 'date', 'anchorClicks', 'updatedAt', 'operationId'].includes(key)) ||
      !nonnegativeInteger(correction.value) || !nonnegativeInteger(correction.anchorClicks) || !validDate(correction.date) ||
      typeof correction.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(correction.updatedAt) ||
      !Number.isFinite(Date.parse(correction.updatedAt)) || new Date(correction.updatedAt).toISOString() !== correction.updatedAt ||
      typeof correction.operationId !== 'string' || !uuidPattern.test(correction.operationId)) throw Error('Invalid download correction.');
    works[slug] = correction as DownloadCorrection;
  }
  return {schemaVersion: 1, works};
}
