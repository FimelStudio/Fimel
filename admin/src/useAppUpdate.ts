import { useEffect, useState } from 'react';
export function useAppUpdate() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const loaded = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map(node => new URL(node.src).pathname);
    const controller = new AbortController(); let running = false;
    const check = async () => {
      if (running || document.visibilityState !== 'visible') return; running = true;
      try {
        const response = await fetch('/', { cache: 'no-store', signal: controller.signal });
        if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) return;
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const src = html.querySelector('script[type="module"][src]')?.getAttribute('src');
        if (html.getElementById('root') && src && !loaded.includes(new URL(src, location.origin).pathname)) setAvailable(true);
      } catch { /* A network failure or expired session is not a new release. */ } finally { running = false; }
    };
    void check(); const interval = setInterval(() => void check(), 60_000);
    window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, []);
  return available;
}
