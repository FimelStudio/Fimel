# Minecraft OBJ Cubizer

Import Minecraft buildings into editable Blockbench Java block models.

## Supported inputs

- OBJ with MTL and PNG textures.
- `.schematic`, `.schem`, `.litematic`, structure `.nbt` and individual `.mca` region files.
- Vanilla and resource-pack blockstate/model JSON, including slabs, stairs, fences, walls, buttons and torches.

## Workflow

The plugin adds a **Minecraft Cubizer** menu to Blockbench. Import structures, choose texture sources from folders or Minecraft Jar/Zip files, repair texture paths and export OBJ textures to resource-pack folders.

## Limitations

Block entity data such as chest inventories, sign text, banner patterns and custom skull owners is not imported. The default limit is 5,000 generated Blockbench cubes. Keep Java Block/Item models compact; the original guide recommends approximately 48 × 48 × 48 blocks.

Requires Blockbench Desktop 4.8.0 or newer.

