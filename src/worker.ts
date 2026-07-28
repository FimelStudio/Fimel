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
