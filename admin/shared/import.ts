import type { Library, Work } from './model';
import { validateLibrary } from './validation';

export type ImportPlan = { library: Library; added: Work[]; skipped: Work[] };
// Imports are additive. Keep edited records, uploads and existing IDs exactly as saved.
export function planImport(current: Library, incoming: unknown): ImportPlan {
  const errors = validateLibrary(incoming);
  if (errors.length) throw new Error(errors.join('\n'));
  const input = incoming as Library;
  const added: Work[] = [], skipped: Work[] = [];
  let order = Math.max(-1, ...current.works.map(work => work.order)) + 1;
  for (const work of input.works) {
    const existing = current.works.find(item => item.id === work.id);
    if (existing) {
      if (existing.project.slug !== work.project.slug || existing.project.type !== work.project.type) throw new Error(`作品 ID 冲突：${work.project.slug}。已有作品的 slug 和分类不能通过导入更换。`);
      skipped.push(work); continue;
    }
    if (current.works.some(item => item.project.slug === work.project.slug)) throw new Error(`作品 slug 已存在但 ID 不同：${work.project.slug}。请先核对记录，未合并任何作品。`);
    added.push({ ...structuredClone(work), order: order++ });
  }
  const library: Library = { schemaVersion: 1, works: [...current.works, ...added] };
  const mergedErrors = validateLibrary(library);
  if (mergedErrors.length) throw new Error(mergedErrors.join('\n'));
  if (new TextEncoder().encode(JSON.stringify(library)).byteLength > 4_000_000) throw new Error('合并后的作品库超过 4 MB，未导入。');
  return { library, added, skipped };
}
