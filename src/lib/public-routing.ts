export function unsafeUrlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127 || character === '\\') return true;
  }
  return false;
}

/** Hash links remain supported, including links saved before clean URLs existed. */
export function legacyPublicPath(hash: string): string | undefined {
  if (!/^#\/(?:$|\?|works(?:[/?#]|$)|docs(?:[/?#]|$)|studio(?:[?#]|$)|contact(?:[?#]|$))/.test(hash)) return;
  const value = hash.slice(1);
  try {
    const url = new URL(value, 'https://studiofimel.com');
    if (url.origin !== 'https://studiofimel.com' || unsafeUrlCharacters(value)) return;
    return url.pathname + url.search + url.hash;
  } catch { return; }
}

export function installPublicRouting(base: string) {
  // GitHub Pages still needs hash routing under its project subdirectory.
  if (base !== '/') return;
  const migrate = (notify: boolean) => {
    const path = legacyPublicPath(window.location.hash);
    if (!path) return;
    window.history.replaceState(window.history.state, '', path);
    if (notify) window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  };
  migrate(false);
  window.addEventListener('hashchange', () => migrate(true));
}
