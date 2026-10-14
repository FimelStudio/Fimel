// Separate local-only entry. Production config points to index.ts, never this file.
import { handle } from './index';
import type { AdminEnv } from './index';
export default {
  fetch(request: Request, env: AdminEnv) {
    const host = new URL(request.url).hostname;
    if (!['127.0.0.1', 'localhost'].includes(host)) return new Response('Local entry only', { status: 403 });
    return handle(request, env, request.headers.get('x-local-test-anonymous') === '1' ? {} : {
      access: { aud: 'local-test', getIdentity: async () => ({ email: 'local-admin@example.invalid' }) },
    });
  },
};
