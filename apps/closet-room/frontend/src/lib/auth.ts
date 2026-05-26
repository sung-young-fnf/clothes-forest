/**
 * No-Auth 모드 — 로그인 없이 바로 사용
 *
 * SSO로 전환하려면:
 * 1. cp src/lib/auth-modes/auth-sso.ts src/lib/auth.ts
 * 2. .env에 AZURE_AD_CLIENT_ID/SECRET/TENANT_ID 설정
 * 3. pnpm dev 재시작
 */

// 더미 session — 항상 인증됨
const dummySession = {
  user: { name: 'Dev User', email: 'dev@localhost' },
  accessToken: 'no-auth-mode',
  expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
};

// auth() — 항상 세션 반환
export async function auth() {
  return dummySession;
}

// NextAuth handlers (no-op)
export const handlers = {
  GET: () => Response.json(dummySession),
  POST: () => Response.json(dummySession),
};

// signIn/signOut (no-op)
export const signIn = () => {};
export const signOut = () => {};
