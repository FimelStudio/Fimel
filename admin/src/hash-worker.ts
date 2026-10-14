import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { PART_SIZE } from '../shared/model';
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data; const hasher = sha256.create(); const parts: string[] = [];
    for (let offset = 0; offset < file.size; offset += PART_SIZE) {
      const bytes = new Uint8Array(await file.slice(offset, offset + PART_SIZE).arrayBuffer());
      hasher.update(bytes); parts.push(bytesToHex(sha256(bytes)));
      self.postMessage({ progress: Math.min(file.size, offset + PART_SIZE) / file.size });
    }
    self.postMessage({ sha256: bytesToHex(hasher.digest()), parts });
  } catch { self.postMessage({ error: '无法读取文件，请重新选择。' }); }
};
