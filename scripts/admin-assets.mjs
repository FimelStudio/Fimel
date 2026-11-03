import { cp, mkdir } from 'node:fs/promises';
await mkdir('admin/dist/assets', { recursive: true });
await cp('public/assets/brand', 'admin/dist/assets/brand', { recursive: true });
await cp('public/assets/fonts/minecraft-seven', 'admin/dist/assets/fonts/minecraft-seven', { recursive: true });
await mkdir('admin/dist/migration', { recursive: true });
await cp('.artifacts/admin-migration/library.json', 'admin/dist/migration/library.json');
await mkdir('admin/dist/migration/docs-example', { recursive: true });
await cp('admin/examples/docs-example.json', 'admin/dist/migration/docs-example/docs-example.json');
await cp('admin/examples/docs-example/images', 'admin/dist/migration/docs-example/images', { recursive: true });
