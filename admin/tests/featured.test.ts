import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWork } from '../shared/model';
import { DEFAULT_SITE_CONTENT } from '../../src/content/site-content';
import { matchesFeaturedGroup } from '../../src/content/home-featured';
import { featuredIssue, moveFeaturedWork, sitePublicationIssues } from '../shared/featured';

test('公开、发行状态和分类分别校验，数据包发布后仍不属于精选地图', () => {
  const project = { ...makeWork().project, slug: 'fimel-card', type: 'datapacks' as const, status: 'released' as const, title: { zh: '卡牌数据包' } };
  const wrongGroup = featuredIssue('maps', project.slug, project)!;
  assert.equal(wrongGroup.target, 'released');
  assert.match(wrongGroup.message, /作品已公开，但分类不适合“精选地图”.*数据包/);
  assert.doesNotMatch(wrongGroup.message, /尚未公开/);
  assert.equal(featuredIssue('released', project.slug, project), undefined);
  assert.match(featuredIssue('development', project.slug, project)!.message, /作品已公开，但发行状态/);
  assert.match(featuredIssue('released', project.slug, undefined)!.message, /精选作品尚未公开/);
  assert.equal(matchesFeaturedGroup(project, 'maps'), false);
  assert.equal(matchesFeaturedGroup(project, 'released'), true);
  assert.equal(matchesFeaturedGroup({ type: 'bedrock', status: 'released' }, 'maps'), true);
  assert.equal(matchesFeaturedGroup({ type: 'java', status: 'released' }, 'maps'), false);
  assert.equal(matchesFeaturedGroup({ type: 'datapacks', status: 'development' }, 'development'), true);
});

test('显式移组去重并保留其他推荐顺序，满额目标不丢现有选择', () => {
  const site = structuredClone(DEFAULT_SITE_CONTENT);
  site.featured = { maps: ['map-one', 'fimel-card', 'map-two'], released: ['tool-one', 'fimel-card', 'tool-two'], development: ['fimel-card', 'work-one'] };
  const before = structuredClone(site);
  const moved = moveFeaturedWork(site, 'fimel-card', 'released');
  assert.deepEqual(moved.featured, { maps: ['map-one', 'map-two'], released: ['tool-one', 'fimel-card', 'tool-two'], development: ['work-one'] });
  assert.deepEqual(site, before);
  const full = { ...site, featured: { ...site.featured, released: Array.from({ length: 12 }, (_, i) => `work-${i}`) } };
  assert.deepEqual(moveFeaturedWork(full, 'fimel-card', 'released'), full);
  const pending = { ...site, featured: { maps: [], released: ['missing'], development: [] } };
  assert.match(sitePublicationIssues(pending, []).join('\n'), /精选作品尚未公开：missing/);
});
