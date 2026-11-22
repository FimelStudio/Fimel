import type { StorageScan } from '../shared/storage';
import { RequestError } from './api';

export type ScanProgress = { scan: StorageScan; etag: string };
type ScanTransport = {
  read(): Promise<ScanProgress>;
  step(current: ScanProgress): Promise<ScanProgress>;
  active(): boolean;
  progress(current: ScanProgress, note?: string): void;
  wait(ms: number): Promise<void>;
};
export function retryableScanError(error: unknown): boolean {
  if (!(error instanceof RequestError)) return false;
  const details = error.details as { retryable?: boolean; kind?: string } | undefined;
  if (details?.retryable === false) return false;
  if (error.status === 409) return details?.kind === 'scan-conflict' || /报告已被其他窗口推进|其他窗口已保存此页|对象版本冲突/.test(error.message);
  return [0, 408, 429, 502, 503, 504].includes(error.status);
}

// A failed response does not tell us whether its step committed. Always recover
// the server revision before retrying; never replay a stale checkpoint blindly.
export async function advanceStorageScan(initial: ScanProgress, transport: ScanTransport): Promise<ScanProgress> {
  let current = initial, failures = 0;
  while (current.scan.status !== 'ready' && transport.active()) {
    try {
      const next = await transport.step(current);
      if (next.scan.id !== current.scan.id || next.etag !== current.etag) failures = 0;
      else if (++failures > 4) throw new Error('扫描进度未能推进，已保留服务端进度。请稍后点击“继续扫描”。');
      current = next; transport.progress(current);
    } catch (error) {
      if (!transport.active()) return current;
      if (!retryableScanError(error)) throw error;
      try {
        const saved = await transport.read();
        if (saved.scan.id !== current.scan.id || saved.etag !== current.etag) {
          current = saved; failures = 0;
          transport.progress(current, '已读取服务器最新进度，正在继续扫描。');
          continue;
        }
      } catch (readError) { if (!retryableScanError(readError)) throw readError; }
      if (++failures > 4) throw new Error(`扫描已暂停，服务端进度仍保留。${error instanceof Error ? error.message : ''} 稍后点击“继续扫描”即可。`, { cause:error });
      transport.progress(current, `连接暂时中断，正在恢复扫描（${failures}/4）。`);
      await transport.wait(Math.min(500 * 2 ** (failures - 1), 4000));
    }
  }
  return current;
}

export async function readStoragePage<T>(read: () => Promise<T>, wait: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) { if (attempt >= 3 || !retryableScanError(error)) throw error; await wait(500 * 2 ** attempt); }
  }
}
