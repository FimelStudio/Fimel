import { useEffect, useState } from 'react';
import { DOCS_MAX_BYTES, parseDocsManifest, type DocsManifest } from '../content/docs';

const empty: DocsManifest = { schemaVersion: 1, publicationId: 'empty', publishedAt: '1970-01-01T00:00:00.000Z', categories: [], documents: [] };

export function useDocumentation() {
  const [data, setData] = useState<DocsManifest | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; let reading = false; let controller: AbortController | undefined;
    const load = async () => {
      if (reading || document.hidden) return;
      reading = true; controller = new AbortController();
      try {
        const configured = import.meta.env.VITE_DOCS_URL;
        const url = new URL(typeof configured === 'string' && configured ? configured : 'https://download.studiofimel.com/data/docs.json', window.location.href);
        if (url.protocol !== 'https:' && !(import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error('Unsupported documentation origin');
        const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), cache: 'no-store', credentials: 'omit' });
        let next = empty;
        if (response.status !== 404) {
          if (!response.ok || Number(response.headers.get('content-length')) > DOCS_MAX_BYTES) throw Error('Documentation unavailable');
          const reader = response.body?.getReader(); if (!reader) throw Error('Empty documentation response');
          const chunks: Uint8Array[] = []; let size = 0;
          for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > DOCS_MAX_BYTES) { await reader.cancel(); throw Error('Oversized documentation'); } chunks.push(chunk.value); }
          const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
          next = parseDocsManifest(JSON.parse(new TextDecoder().decode(bytes)));
        }
        if (active) { setData(previous => previous?.publicationId === next.publicationId ? previous : next); setError(false); }
      } catch { if (active && !controller.signal.aborted) setError(true); }
      finally { reading = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60000);
    const visible = () => { if (!document.hidden) void load(); }; document.addEventListener('visibilitychange', visible);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [attempt]);
  return { data, error, retry: () => { setError(false); setAttempt(value => value + 1); } };
}
