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
const BINGO_DOWNLOAD_PATH = '/mods/bingo-but-dont-do-it-1.21.11-v1.0.jar';
const BINGO_DOWNLOAD_MANIFEST_PATH = '/mods/bingo-but-dont-do-it-fallback.json';

interface DownloadManifest {
  fileName: string;
  size: number;
  parts: string[];
}

const getBingoDownloadManifest = async (
  request: Request,
  env: WorkerEnvironment,
): Promise<DownloadManifest> => {
  const manifestUrl = new URL(BINGO_DOWNLOAD_MANIFEST_PATH, request.url);
  const response = await env.ASSETS.fetch(new Request(manifestUrl));

  if (!response.ok) {
    throw new Error(`Fallback download manifest returned HTTP ${response.status}.`);
  }

  const manifest = await response.json() as Partial<DownloadManifest>;
  if (
    typeof manifest.fileName !== 'string' ||
    typeof manifest.size !== 'number' ||
    !Array.isArray(manifest.parts) ||
    manifest.parts.length === 0 ||
    !manifest.parts.every((part) => typeof part === 'string')
  ) {
    throw new Error('Fallback download manifest is invalid.');
  }

  return manifest as DownloadManifest;
};

const serveBingoDownload = async (
  request: Request,
  env: WorkerEnvironment,
): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const manifest = await getBingoDownloadManifest(request, env);
  const headers = new Headers({
    'Content-Type': 'application/java-archive',
    'Content-Disposition': `attachment; filename="${manifest.fileName}"`,
    'Content-Length': String(manifest.size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    return new Response(null, { headers });
  }

  let partIndex = 0;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          if (!activeReader) {
            if (partIndex >= manifest.parts.length) {
              controller.close();
              return;
            }

            const partUrl = new URL(manifest.parts[partIndex], request.url);
            const partResponse = await env.ASSETS.fetch(new Request(partUrl));
            partIndex += 1;

            if (!partResponse.ok || !partResponse.body) {
              throw new Error(`Fallback download part returned HTTP ${partResponse.status}.`);
            }

            activeReader = partResponse.body.getReader();
          }

          const chunk = await activeReader.read();
          if (chunk.done) {
            activeReader = null;
            continue;
          }

          controller.enqueue(chunk.value);
          return;
        }
      } catch (error) {
        controller.error(error);
      }
    },

    async cancel(reason) {
      await activeReader?.cancel(reason);
    },
  });

  return new Response(body, { headers });
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
    if (new URL(request.url).pathname === BINGO_DOWNLOAD_PATH) {
      return serveBingoDownload(request, env);
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
