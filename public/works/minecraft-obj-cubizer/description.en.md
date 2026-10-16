# Minecraft OBJ Cubizer

Import Minecraft building OBJ exports or structure files into Blockbench as editable cube models. Use them for Minecraft Java resource-pack models, or continue working in an existing Animated Java Blueprint project.

## Inputs

- **Building OBJ**: reads `.obj`, `.mtl` and PNG textures, rebuilding axis-aligned cubes. It targets Minecraft-style buildings, not arbitrary triangle meshes or curved objects.
- **Structures**: supports `.schematic`, `.schem`, `.litematic`, structure `.nbt` and individual `.mca` region files.
- **Models and textures**: accepts resource-pack folders and Minecraft JAR/ZIP files, reads blockstate/model JSON and special block shapes, and computes missing UVs from face dimensions.

## Workflow in the v1.6 series

1. Extract the package and install `minecraft_obj_cubizer.js` through Blockbench Desktop's local plugin installer. Blockbench 5.2.2 is recommended; the site's v1.6.1 release lists 5.2.0 or newer.
2. Open the **Minecraft Cubizer** menu and import an OBJ, or preview a Minecraft structure first.
3. Choose a texture source and filter by inclusive X/Y/Z bounds and block IDs. IDs support `*` wildcards; bounds apply before centering or moving the model.
4. Inspect the low-detail selection preview before creating editable cubes. Background processing can be cancelled; cube creation runs in batches with progress and rollback on cancellation.
5. Check textures, special blocks and the fallback report. Export OBJ, structure and generated tiled textures into the appropriate resource-pack paths as needed.

## Large builds and animation

The default **building performance mode** in v1.6.1 batches compatible unselected cubes while retaining the original model, UVs, selection and editing data. Selected cubes, paint/animation modes and unsupported textures use native rendering. The mode can be disabled. New cube drawing is deferred during import to avoid repeated whole-building refreshes as textures load.

Animated Java Blueprint imports preserve existing texture dimensions, UV mode and animations. Grouping supports individual blocks, spatial chunks, a single group and animation parts. Animated Java's automatic mode separates a static body from explicitly defined moving parts. Part bounds and pivots can be set in the preview; merging does not cross part boundaries.

Block merging, translucent merging and hidden-face removal are optional and disabled by default. Keep them disabled when individual blocks must remain separate for editing or animation. Generated textures preserve face UV density by cropping and tiling, including vertical animation strips; export generated PNGs and their `.mcmeta` files with the model.

## Limits

- Structure import does not read block-entity contents such as chest inventories, sign text, banner patterns or player-head owners.
- The default limit is **5,000 generated cubes**, not source blocks. Source-block processing has a separate limit. The preview shows at most 2,048 coarse instances without full model textures.
- The usual Java Block/Item coordinate range is `-16` to `32`: roughly 48 blocks at one unit per block, or three blocks at 16 units per block.
- Vanilla PNGs read from Minecraft JAR/ZIP files are preview-only and are not automatically saved beside the model. Generated custom textures require explicit export.
- Background parsing requires Worker and DecompressionStream. Final cube creation and editing still use main-thread time and GPU memory; narrow the selection or split very large imports.

The package documentation records desktop checks with Blockbench 5.2.2 and Animated Java 1.11.0. In-game export and animation playback have not been verified. See the Versions tab for each file, platform requirement and release notes.
