interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface WorkerEnvironment {
  ASSETS: StaticAssetsBinding;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const KEEPALIVE_TABLE = 'work_download_targets';
const LEGACY_DOWNLOAD_PATHS = new Set([
  '/mods/bingo-but-dont-do-it-1.21.11-v1.0.jar',
  '/plugins/minecraft-obj-cubizer/minecraft_obj_cubizer-1.4.0.zip',
  '/plugins/minecraft-explorer/MinecraftExplorer-1.0-win-x64.exe',
]);

const serveLegacyDownload = async (request: Request, env: WorkerEnvironment): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  try {
    const manifestUrl = new URL('/downloads/r2-redirects.json', request.url);
    const response = await env.ASSETS.fetch(new Request(manifestUrl));
    if (!response.ok) throw new Error('R2 redirect manifest unavailable.');
    const manifest = await response.json() as Record<string, unknown>;
    const destination = manifest[new URL(request.url).pathname];
    if (typeof destination !== 'string') throw new Error('Legacy download is not mapped.');
    const url = new URL(destination);
    if (url.origin !== 'https://download.studiofimel.com' || !url.pathname.startsWith('/works/') || url.username || url.password) {
      throw new Error('Invalid R2 redirect destination.');
    }
    return new Response(null, { status: 302, headers: {
      Location: url.href, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return new Response('Download temporarily unavailable.', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
};

const keepSupabaseActive = async (env: WorkerEnvironment) => {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase keepalive requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) as Worker runtime variables.',
    );
  }

  const endpoint = new URL(
    `/rest/v1/${KEEPALIVE_TABLE}`,
    `${supabaseUrl.replace(/\/+$/, '')}/`,
  );
  endpoint.searchParams.set('select', 'slug');
  endpoint.searchParams.set('limit', '1');

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      apikey: supabaseKey,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 200);
    throw new Error(
      `Supabase keepalive failed with HTTP ${response.status}: ${responseText}`,
    );
  }

  await response.arrayBuffer();
  console.log('[supabase-keepalive] Database read completed.');
};

export default {
  fetch(request: Request, env: WorkerEnvironment) {
    if (LEGACY_DOWNLOAD_PATHS.has(new URL(request.url).pathname)) {
      return serveLegacyDownload(request, env);
    }

    return env.ASSETS.fetch(request);
  },

  scheduled(
    _controller: unknown,
    env: WorkerEnvironment,
    context: WorkerExecutionContext,
  ) {
    context.waitUntil(keepSupabaseActive(env));
  },
};
