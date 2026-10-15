import type { Work } from '../shared/model';
import { validateLibrary } from '../shared/validation';
import { sameWork, mergeWork } from '../shared/revisions';
import { ApiError, json, putJson, readJson } from './http';
import { backup, libraryState, publicState, LIBRARY_KEY } from './storage';

export async function saveWork(request: Request, priv: R2Bucket, pub: R2Bucket, id: string,record?:(before:Work|null,after:Work)=>void) {
  const input = await readJson(request,8_000_000) as { base?: Work | null; work?: Work };
  if (!input || !Object.hasOwn(input, 'base') || input.base !== null && validateLibrary({ schemaVersion: 1, works: [input.base] }).length ||
    !input.work || input.work.id !== id || input.base && input.base.id !== id) throw new ApiError(422, '作品保存请求无效，请重新加载后重试。');
  const errors = validateLibrary({ schemaVersion: 1, works: [input.work] }); if (errors.length) throw new ApiError(422, errors.join('\n'));
  const incoming = input.work;
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await libraryState(priv); const current = state.value.works.find(w => w.id === id) ?? null;
    let candidate = incoming;
    if (!sameWork(current, input.base)) {
      if (current && input.base) {
        const merged = mergeWork(input.base, current, incoming);
        if (merged.conflicts.length) return json({ error: '此作品已被其他管理员修改。你的编辑已保留，请核对冲突字段。', conflict: { current, base: input.base, incoming, paths: merged.conflicts } }, 409);
        candidate = merged.work;
      } else return json({ error: '作品保存基线已改变，请核对最新内容。', conflict: { current, base: input.base, incoming, paths: ['作品记录'] } }, 409);
    }
    if (current && (current.project.slug !== candidate.project.slug || current.project.type !== candidate.project.type)) throw new ApiError(422, '已有作品 slug 和分类保持稳定，避免历史地址失效。');
    const published = await publicState(pub);
    if (candidate.workflow === 'archived' && published.value.projects.some(p => p.slug === candidate.project.slug)) throw new ApiError(422, '已公开作品请先下架，再归档。');
    candidate = { ...candidate, updatedAt: new Date().toISOString() };
    const library = { ...state.value, works: current ? state.value.works.map(w => w.id === id ? candidate : w) : [...state.value.works, candidate] };
    const problems = validateLibrary(library); if (problems.length) throw new ApiError(422, problems.join('\n'));
    await backup(priv, state.value, 'library');
    try {
      const saved = await putJson(priv, LIBRARY_KEY, library, state.etag);
      record?.(current,candidate);
      return json({ saved: true, library, public: published.value, publicEtag: published.etag }, 200, saved.httpEtag);
    } catch (error) { if (!(error instanceof ApiError) || error.status !== 409 || attempt === 3) throw error; }
  }
  throw new ApiError(409, '作品库正被频繁更新。你的编辑已保留，请稍后重试。');
}
