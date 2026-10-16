## 1.6.1 / Building import and viewport performance

Package changelog: 2026-10-14 / Ylong. Published on this site: 2026-10-16.

- Defer newly imported cube drawing until import finishes or is cancelled, restoring native rendering afterwards.
- Set image dimensions before loading textures and avoid repeated whole-model geometry and UV refreshes.
- Enable building performance mode by default: batch compatible unselected cubes by parent group and material while retaining original model data and native picking.
- Limit UV overlay controls for large selections. Restore the original behavior when performance mode is disabled or the project changes.
- Exclude animated, translucent and special-rendering textures; detect an enabled Multi Cube Mesh Optimizer to avoid duplicate proxy rendering.

The package records desktop performance, image comparison, selection, editing, undo and save checks with Blockbench 5.2.2. These records do not establish in-game export or playback support.

## 1.6.0 / Background processing, selection preview and animation parts

2026-10-13 / Ylong.

- Move NBT decompression, parsing and selection scanning into a cancellable Worker. Skip unrelated entity data and source blocks outside the selection.
- Cache state/model information and compiled ID filters; support asynchronous JAR reading and caching under Blockbench 5.2.2's restricted file API, including ZIP64.
- Add a low-detail structure preview with up to 2,048 instances. Only create editable cubes after confirming the selection.
- Define animation-part bounds and pivots in the preview. Animated Java automatic grouping uses a static body plus explicit moving parts; merging respects their boundaries.
- Merge compatible slabs, some stairs and multi-cube models along continuous axes; preserve shapes and supported right-angle state rotations.
- Crop and tile real face UV pixels, including non-square textures and vertical animation strips. Preserve frame metadata and export `.mcmeta` with animated PNGs.
- Keep translucent merging separate and disabled by default; free preview and Worker resources on close, cancel or unload.

## 1.5.0 / Newer compatibility and large-building import

2026-10-13 / Ylong.

- Support Blockbench 5.2.2 texture references and imports into existing Animated Java Blueprints without resetting texture size, UV mode or animations.
- Add inclusive coordinate bounds, block-ID wildcard filters, grouping choices and configurable scale.
- Add optional full-block merging, tiled textures and hidden-face removal; create cubes in batches with progress and cancellation rollback.
- Reuse matching textures and keep source-block processing limits separate from generated-cube limits.
- Fix classic schematic metadata/AddBlocks, Sponge schematic v3 wrappers, litematic packed states and negative dimensions, and MCA state decoding based on DataVersion.

## 1.4.0 / Plugin page and local installation

2026-05-19 / Ylong.

Reorganized release records and plugin-page content, corrected action ownership and local installation persistence, and clarified cube-count and Java model-size limits. This historical release requires Blockbench Desktop 4.8.0 or newer.
