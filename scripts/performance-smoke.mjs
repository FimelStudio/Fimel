import { strict as assert } from 'node:assert';
import { chromium } from '@playwright/test';

// Renderer regression check against Vite dev or the production preview: draw
// calls, TNT, and suspended scenes. This does not claim hardware FPS or CWV.
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const installInspector = () => {
  localStorage.setItem('fimel_theme', 'dark');
  localStorage.setItem('fimel_user_lang', 'zh');
  const roots = new Set();
  let rendererId = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => ++rendererId,
    onCommitFiberRoot: (_id, root) => roots.add(root),
    onCommitFiberUnmount: () => {},
  };
  window.__findPerformanceRoot = () => {
    const canvas = document.querySelector('#hero canvas');
    const queue = [...roots].map(root => root.current);
    while (queue.length) {
      const fiber = queue.pop();
      if (!fiber) continue;
      const candidates = [fiber.memoizedProps?.value, fiber.stateNode?.root, fiber.stateNode?.object?.__r3f?.root, fiber.stateNode?.__r3f?.root];
      for (const store of candidates) {
        if (typeof store?.getState !== 'function') continue;
        const state = store.getState();
        if (state?.scene && state.gl?.domElement === canvas) return store;
      }
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    return null;
  };
  // Keep the random block field repeatable without changing production assets.
  let seed = 42;
  Math.random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
};
await page.addInitScript(installInspector);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#hero canvas', { timeout: 45000 });
  await page.waitForFunction(() => {
    const store = window.__findPerformanceRoot();
    if (!store) return false;
    window.__performanceRoot = store;
    return store.getState().scene.children.some(child => child.isInstancedMesh);
  }, null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const state = window.__performanceRoot.getState();
    return state.scene.children.some(child => child.isInstancedMesh) && state.gl.info.render.calls > 0;
  }, null, { timeout: 45000 });
  // Allow the existing entrance camera and initial loading curtain to finish.
  await page.waitForTimeout(4000);
  await page.waitForFunction(() => window.__performanceRoot.getState().scene.background.getHexString() === '0d1117');
  await page.getByRole('button', { name: '切换至亮色', exact: true }).click();
  await page.waitForFunction(() => window.__performanceRoot.getState().scene.background.getHexString() === 'f4f4f5');
  assert.equal(await page.evaluate(() => window.__findPerformanceRoot() === window.__performanceRoot), true, 'Theme switching must not remount the canvas');
  await page.getByRole('button', { name: '切换至暗色', exact: true }).click();
  await page.waitForFunction(() => window.__performanceRoot.getState().scene.background.getHexString() === '0d1117');
  console.log(JSON.stringify({ canvasDarkLightSwitch: 'passed' }));
  assert.equal(await page.locator('#fimel-hud-panel').count(), 0, 'Closed HUD must not cover content');
  await page.getByRole('button', { name: 'SHOW M-HUD', exact: true }).click();
  await page.locator('#fimel-hud-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#fimel-hud-panel a').count(), 9, 'Opening HUD retains its nine Minecraft slots');
  await page.getByRole('button', { name: 'HIDE M-HUD', exact: true }).click();
  assert.equal(await page.locator('#fimel-hud-panel').count(), 0, 'Closing HUD removes the panel');
  const desktop = await page.evaluate(() => {
    const state = window.__performanceRoot.getState();
    let instances = 0;
    let instanceGroups = 0;
    let tnt = 0;
    state.scene.traverse(object => {
      if (object.isInstancedMesh) { instances += object.count; instanceGroups++; }
      if (object.isMesh && object.__r3f?.handlers.onClick) tnt++;
    });
    return { calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles, instances, instanceGroups, tnt, camera: state.camera.position.toArray(), frameloop: state.frameloop };
  });
  assert.equal(desktop.instanceGroups, 18, 'Each decorative texture should have one instance group');
  assert.ok(desktop.instances >= 100, 'Keep the characteristic block field');
  assert.ok(desktop.calls < 300, `Desktop scene draw calls must remain below 300; got ${desktop.calls}`);
  console.log(JSON.stringify({ desktop }));

  let point = await page.evaluate(() => {
    const state = window.__performanceRoot.getState();
    const canvas = document.querySelector('#hero canvas');
    const bounds = canvas.getBoundingClientRect();
    const clickable = [];
    state.scene.traverse(object => {
      if (object.isMesh && object.__r3f?.handlers.onClick) clickable.push(object);
    });
    const candidates = [];
    const pointer = state.pointer.clone();
    // A cube's center may be behind hero copy while one of its faces remains
    // accessible. Test actual raycastable canvas pixels, not centers only.
    for (let y = 110; y < innerHeight - 65; y += 16) {
      for (let x = 24; x < innerWidth - 24; x += 16) {
        if (document.elementFromPoint(x, y) !== canvas) continue;
        pointer.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
        state.raycaster.setFromCamera(pointer, state.camera);
        const hit = state.raycaster.intersectObjects(clickable, false)[0];
        if (!hit) continue;
        const object = hit.object;
        const center = object.getWorldPosition(object.position.clone());
        candidates.push({ x, y, size: object.geometry.parameters.width / state.camera.position.distanceTo(center) });
      }
    }
    return candidates.sort((a, b) => b.size - a.size)[0];
  });
  if (!point) {
    // A global RNG seed does not guarantee a visible TNT: React/Three also use
    // Math.random, and deferred startup changes that call order. For this
    // interaction check only, move ONE existing TNT mesh into exposed canvas
    // space. Scene counts/draw calls above remain untouched; production block
    // generation is unchanged, and the click/fuse/explosion still run normally.
    point = await page.evaluate(() => {
      const state = window.__performanceRoot.getState();
      const canvas = document.querySelector('#hero canvas');
      const bounds = canvas.getBoundingClientRect();
      const clickable = [];
      state.scene.traverse(object => {
        if (object.isMesh && object.__r3f?.handlers.onClick) clickable.push(object);
      });
      const target = clickable.sort((a, b) => b.geometry.parameters.width - a.geometry.parameters.width)[0];
      if (!target?.parent) return null;
      const pointer = state.pointer.clone();
      for (let y = innerHeight - 100; y >= 130; y -= 32) {
        for (let x = innerWidth - 80; x >= 40; x -= 32) {
          if (document.elementFromPoint(x, y) !== canvas) continue;
          pointer.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
          state.raycaster.setFromCamera(pointer, state.camera);
          const worldPoint = state.raycaster.ray.at(10, target.position.clone());
          target.parent.updateWorldMatrix(true, false);
          target.position.copy(target.parent.worldToLocal(worldPoint));
          target.updateWorldMatrix(true, false);
          state.invalidate();
          const hit = state.raycaster.intersectObjects(clickable, false)[0];
          if (hit) return { x, y, size: target.geometry.parameters.width / 10, fixture: true };
        }
      }
      return null;
    });
  }
  if (!point) {
    await page.screenshot({ path: '.artifacts/performance-tnt-surface.png' });
    console.log(JSON.stringify(await page.evaluate(() => {
    const canvas = document.querySelector('#hero canvas');
    const state = window.__performanceRoot.getState();
    const bounds = canvas.getBoundingClientRect();
    const tnt = [];
    state.scene.traverse(object => {
      if (!object.isMesh || !object.__r3f?.handlers.onClick) return;
      const projected = object.getWorldPosition(object.position.clone()).project(state.camera);
      const x = bounds.left + (projected.x + 1) * bounds.width / 2;
      const y = bounds.top + (1 - projected.y) * bounds.height / 2;
      tnt.push({ x, y, z: projected.z, position: object.getWorldPosition(object.position.clone()).toArray(), size: object.geometry.parameters.width, blocking: document.elementFromPoint(x, y)?.outerHTML.slice(0, 160) });
    });
    return { canvas: bounds.toJSON(), top: document.elementFromPoint(720, 500)?.outerHTML.slice(0, 300), camera: state.camera.position.toArray(), tnt };
    })));
  }
  assert.ok(point, 'The generated scene should expose a clickable on-screen TNT');
  console.log(JSON.stringify({ point }));
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => {
    let primed = false;
    window.__performanceRoot.getState().scene.traverse(object => {
      if (object.isMesh && object.__r3f?.handlers.onClick && object.scale.x > 1.001) primed = true;
    });
    return primed;
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => {
    let count = 0;
    window.__performanceRoot.getState().scene.traverse(object => { if (object.isSprite) count++; });
    return count >= 15;
  }, null, { timeout: 20000 });
  console.log(JSON.stringify({ desktop, tntClickFuseExplosion: 'passed' }));

  // Headless tabs are not reliably backgrounded by bringToFront. Simulate the
  // browser's hidden flag/event, then verify the app actually suspends its loop.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__performanceRoot.getState().frameloop === 'demand', null, { timeout: 5000 });
  const hiddenBefore = await page.evaluate(() => window.__performanceRoot.getState().gl.info.render.frame);
  await page.waitForTimeout(800);
  const hiddenAfter = await page.evaluate(() => window.__performanceRoot.getState().gl.info.render.frame);
  assert.ok(hiddenAfter - hiddenBefore <= 1, 'Hidden-page signal must stop continuous rendering');
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__performanceRoot.getState().frameloop === 'always', null, { timeout: 5000 });
  console.log(JSON.stringify({ hiddenSignalFrameDelta: hiddenAfter - hiddenBefore, hudOpenClose: 'passed' }));

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => window.__performanceRoot.getState().frameloop === 'demand', null, { timeout: 10000 });
  const before = await page.evaluate(() => window.__performanceRoot.getState().gl.info.render.frame);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.__performanceRoot.getState().gl.info.render.frame);
  assert.ok(after - before <= 1, `Offscreen scene kept rendering ${after - before} frames`);
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(JSON.stringify({ offscreenFrameDelta: after - before, browserErrors: errors.length }));

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await mobileContext.addInitScript(installInspector);
  await mobileContext.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
  });
  const mobilePage = await mobileContext.newPage();
  const mobileSceneRequests = [];
  mobilePage.on('request', request => {
    if (/(ParticleBackground|WorldCore3D|Float-|react-three|\/three[./-])/i.test(request.url())) mobileSceneRequests.push(request.url());
  });
  await mobilePage.goto(origin, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForSelector('[data-deferred-scene="particles"][data-scene-state="static"]');
  await mobilePage.waitForTimeout(1800);
  const mobile = await mobilePage.evaluate(() => {
    return {
      state: document.querySelector('[data-deferred-scene="particles"]')?.getAttribute('data-scene-state'),
      canvasCount: document.querySelectorAll('#hero canvas').length,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    };
  });
  assert.equal(mobile.state, 'static', 'Reduced motion keeps the lightweight theme background');
  assert.equal(mobile.canvasCount, 0, 'Reduced motion does not initialize a decorative WebGL context');
  assert.deepEqual(mobileSceneRequests, [], 'Reduced motion does not download the 3D modules');
  assert.ok(mobile.width <= mobile.viewport, 'No horizontal mobile overflow');
  assert.equal(await mobilePage.locator('#fimel-hud-panel').count(), 0, 'Mobile HUD starts closed');
  console.log(JSON.stringify({ mobile }));
  await mobileContext.close();
} finally {
  await context.close();
  await browser.close();
}
