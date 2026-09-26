import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fileName = 'bingo-but-dont-do-it-1.21.11-v1.0.jar';
const publicPath = `/mods/${fileName}`;
const distDirectory = path.resolve(process.cwd(), 'dist');
const sourcePath = path.join(distDirectory, 'mods', fileName);
const chunkSize = 20 * 1024 * 1024;

const source = await readFile(sourcePath);
const parts = [];

for (let offset = 0, index = 1; offset < source.length; offset += chunkSize, index += 1) {
  const partName = `${fileName}.part-${String(index).padStart(2, '0')}`;
  const partPath = path.join(distDirectory, 'mods', partName);
  await writeFile(partPath, source.subarray(offset, offset + chunkSize));
  parts.push(`/mods/${partName}`);
}

await writeFile(
  path.join(distDirectory, 'mods', 'bingo-but-dont-do-it-fallback.json'),
  `${JSON.stringify({ fileName, size: source.length, parts }, null, 2)}\n`,
);

await writeFile(
  path.join(distDirectory, '.assetsignore'),
  `${publicPath.slice(1)}\n`,
);

console.log(
  `Prepared ${parts.length} Cloudflare-safe fallback parts for ${fileName}.`,
);
