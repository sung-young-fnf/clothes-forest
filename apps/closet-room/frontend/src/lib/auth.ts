/**
 * 현재 인증 모드: SSO (Azure AD / Microsoft Entra ID, NextAuth v5)
 *
 * 동작 조건: .env에 아래 값 필요
 *   AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET / AZURE_AD_TENANT_ID / AUTH_SECRET / NEXTAUTH_URL
 *
 * 모드 전환:
 *   - No-Auth(익명만)로 되돌리려면 아래 경로를 './auth-modes/auth-none' 으로 변경
 *   - SSO 유지하려면 './auth-modes/auth-sso' (현재)
 *
 * 참고: 메인(/) 익명 입장은 별도 JWT 흐름이라 이 설정과 무관하게 동작.
 *       SSO는 /login + 어드민 영역에서만 사용.
 */
export { handlers, auth, signIn, signOut } from './auth-modes/auth-sso';
