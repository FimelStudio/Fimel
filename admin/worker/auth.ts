import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './http';
export type ServerSecrets = { ACCESS_AUD?: string; ACCESS_ISSUER?: string; ADMIN_EMAILS?: string };
export type AccessContext = { access?: { aud: string; getIdentity(): Promise<{ email?: string } | undefined> } };
export async function authenticate(request: Request, env: ServerSecrets, ctx: AccessContext): Promise<string> {
  if (!env.ACCESS_AUD || !env.ACCESS_ISSUER || !env.ADMIN_EMAILS) throw new ApiError(503, '管理身份尚未配置，访问已拒绝。');
  let email: unknown;
  if (ctx.access && ctx.access.aud === env.ACCESS_AUD) email = (await ctx.access.getIdentity())?.email;
  else {
    const token = request.headers.get('cf-access-jwt-assertion');
    if (!token) throw new ApiError(401, '需要 Cloudflare Access 登录。');
    try {
      const issuer = new URL(env.ACCESS_ISSUER);
      if (issuer.protocol !== 'https:' || !issuer.hostname.endsWith('.cloudflareaccess.com') || issuer.pathname !== '/') throw new Error('Invalid issuer');
      const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer)), {
        issuer: issuer.origin, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'],
      });
      email = payload.email;
    } catch { throw new ApiError(401, 'Access 身份验证失败，请重新登录。'); }
  }
  if (typeof email !== 'string' || !env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())) throw new ApiError(403, '当前账号未获管理权限。');
  return email;
}
export function protectWrite(request: Request, origin: string): void {
  if (['GET', 'HEAD'].includes(request.method)) return;
  if (request.headers.get('origin') !== origin || request.headers.get('x-fimel-csrf') !== '1') throw new ApiError(403, '写请求来源验证失败。');
}
