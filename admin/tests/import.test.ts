import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeWork } from '../shared/model';
import { planImport } from '../shared/import';
import type { Library } from '../shared/model';
test('official 28-work import preserves the saved private draft and is repeatable without replacement',async()=>{
  const current=makeWork();current.project.slug='keep-my-draft';current.project.title='保留的私有草稿';current.order=4;
  const library:Library={schemaVersion:1,works:[current]};const official=JSON.parse(await readFile('.artifacts/admin-migration/library.json','utf8'));
  const plan=planImport(library,official);assert.equal(plan.added.length,28);assert.equal(plan.library.works.length,29);
  assert.deepEqual(plan.library.works[0],current);assert.equal(plan.library.works[1].order,5);assert.equal(library.works.length,1);
  const again=planImport(plan.library,official);assert.equal(again.added.length,0);assert.equal(again.skipped.length,28);assert.deepEqual(again.library,plan.library);
});
test('imports keep edited metadata and uploads and block ambiguous slug or ID collisions before any merge',()=>{
  const saved=makeWork();saved.project.slug='existing';saved.project.title='后台修改';const original=structuredClone(saved);original.project.title='旧导出标题';
  const library:Library={schemaVersion:1,works:[saved]};assert.deepEqual(planImport(library,{schemaVersion:1,works:[original]}).library,library);
  const duplicate=structuredClone(original);duplicate.id=crypto.randomUUID();assert.throws(()=>planImport(library,{schemaVersion:1,works:[duplicate]}),/slug 已存在但 ID 不同/);
  duplicate.id=saved.id;duplicate.project.slug='changed-slug';assert.throws(()=>planImport(library,{schemaVersion:1,works:[duplicate]}),/ID 冲突/);
  assert.throws(()=>planImport(library,{schemaVersion:1,works:[{}]}));assert.equal(saved.project.title,'后台修改');
});
