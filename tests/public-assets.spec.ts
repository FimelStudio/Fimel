import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Project } from '../src/content/projects';

test('every catalogue cover and Markdown document resolves from the normalized public directories', async ({ request }) => {
  const catalogue = await (await request.get('/works/catalogue.json')).json() as { projects: Project[] };
  const markdownPaths = new Set<string>();
  // These two in-development works had no dedicated cover before the migration.
  // Preserve their original Minecraft material artwork instead of inventing one.
  const materialArtwork: Record<string, string> = {
    'island-escape-java': 'assets/textures/minecraft/ice.png',
    'production-toolchain': 'assets/textures/minecraft/iron_block.png',
  };
  for (const project of catalogue.projects) {
    if (materialArtwork[project.slug]) expect(project.image).toBe(materialArtwork[project.slug]);
    else expect(project.image).toMatch(new RegExp(`^assets/images/works/${project.slug}/cover\\.`));
    const cover = await request.get(`/${project.image}`);
    expect(cover.ok(), project.image).toBe(true);
    expect(cover.headers()['content-type'], project.image).toMatch(/^image\//);
    for (const source of Object.values(project.content)) {
      const paths = typeof source === 'string' ? [source] : Object.values(source ?? {});
      for (const path of paths) {
        expect(path, project.slug).toMatch(new RegExp(`^works/${project.slug}/[^/]+\\.md$`));
        markdownPaths.add(path);
      }
    }
  }
  for (const path of markdownPaths) {
    const response = await request.get(`/${path}`);
    expect(response.ok(), path).toBe(true);
    const text = await response.text();
    expect(text.trim().length, path).toBeGreaterThan(10);
    expect(text, path).not.toMatch(/<!doctype\s+html|<html(?:\s|>)/i);
  }
});

test('relocated Minecraft UI, textures and sound assets have their real content types', async ({ request }) => {
  const assets = [
    ['assets/images/ui/minecraft/Hotbar.png', /^image\/png/],
    ['assets/images/ui/minecraft/Hotbar_selection.png', /^image\/png/],
    ['assets/images/ui/minecraft/experience_bar_background.png', /^image\/png/],
    ['assets/images/ui/minecraft/experience_bar_progress.png', /^image\/png/],
    ['assets/images/ui/minecraft/Tooltip_background.png', /^image\/png/],
    ['assets/images/ui/minecraft/Toast_advancement.png', /^image\/png/],
    ['assets/textures/minecraft/block_side.png', /^image\/png/],
    ['assets/textures/minecraft/TNT_side.png', /^image\/png/],
    ['assets/textures/minecraft/explosion.png', /^image\/png/],
    ['assets/textures/minecraft/smoke.png', /^image\/png/],
    ['assets/audio/minecraft/Fuse.ogg', /^(?:audio|application)\/ogg/],
    ['assets/audio/minecraft/Explosion2.ogg', /^(?:audio|application)\/ogg/],
  ] as const;
  for (const [path, mime] of assets) {
    const response = await request.get(`/${path}`);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()['content-type'], path).toMatch(mime);
    expect((await response.body()).byteLength, path).toBeGreaterThan(20);
  }
});

test('all NetEase galleries preserve source provenance and serve their own local Markdown media', async ({ request }) => {
  const catalogue = await (await request.get('/works/catalogue.json')).json() as { projects: Project[] };
  const neteaseProjects = catalogue.projects.filter(project => project.type === 'bedrock');
  expect(neteaseProjects.length).toBeGreaterThan(0);
  for (const project of neteaseProjects) {
    const snapshot = JSON.parse(readFileSync(new URL(`../content-sources/netease/${project.slug}.json`, import.meta.url), 'utf8'));
    expect(snapshot.gallery.sourceField, project.slug).toBe('entity.pic_url_list');
    expect(snapshot.gallery.retrieved, project.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.gallery.images.length, project.slug).toBeGreaterThan(0);
    expect(snapshot.gallery.failures, project.slug).toEqual([]);
    const source = project.content.description;
    const path = typeof source === 'string' ? source : source?.zh ?? '';
    const response = await request.get(`/${path}`);
    expect(response.ok(), path).toBe(true);
    const markdown = await response.text();
    for (const [index, image] of snapshot.gallery.images.entries()) {
      const canonicalPath = `assets/images/works/${project.slug}/gallery-${String(index + 1).padStart(2, '0')}.webp`;
      expect(image.localPath, project.slug).toBe(canonicalPath);
      expect(image.sourceKind, canonicalPath).toBe('store-gallery');
      expect(image.sourceField, canonicalPath).toBe('entity.pic_url_list');
      expect(image.sourceUrl, canonicalPath).toMatch(/^https:\/\//);
      expect(image.originalSha256, canonicalPath).toMatch(/^[a-f0-9]{64}$/);
      expect(image.width, canonicalPath).toBeGreaterThan(0);
      expect(image.height, canonicalPath).toBeGreaterThan(0);
      expect(image.width, canonicalPath).toBeLessThanOrEqual(image.originalWidth);
      expect(image.height, canonicalPath).toBeLessThanOrEqual(image.originalHeight);
      expect(markdown, path).toContain(canonicalPath);
      const media = await request.get(`/${canonicalPath}`);
      expect(media.ok(), canonicalPath).toBe(true);
      expect(media.headers()['content-type'], canonicalPath).toMatch(/^image\/webp/);
      expect((await media.body()).byteLength, canonicalPath).toBe(image.bytes);
    }
  }
});
