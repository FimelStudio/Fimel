import { cp, mkdir } from 'node:fs/promises';
await mkdir('admin/dist/assets', { recursive: true });
await cp('public/assets/brand', 'admin/dist/assets/brand', { recursive: true });
await cp('public/assets/fonts/minecraft-seven', 'admin/dist/assets/fonts/minecraft-seven', { recursive: true });
await mkdir('admin/dist/migration', { recursive: true });
await cp('.artifacts/admin-migration/library.json', 'admin/dist/migration/library.json');
