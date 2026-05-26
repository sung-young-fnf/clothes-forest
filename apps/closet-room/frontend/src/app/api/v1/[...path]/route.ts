import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TOKEN_COOKIE = 'closet_token';

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * BFF Catch-All Proxy — V1 익명 JWT 흐름
 *
 * 패턴:
 * - POST /api/v1/sessions: 토큰 없이 통과 (입장). 응답의 token을 httpOnly 쿠키에 저장
 * - 그 외 경로: 쿠키의 closet_token을 Bearer로 backend에 전달. 쿠키 없으면 401
 *
 * Backend는 setGlobalPrefix('api')이므로 /api/v1/{path} → ${BACKEND_URL}/api/{path}
 */

function isLoginEndpoint(path: string[], method: string): boolean {
  return method === 'POST' && path.length === 1 && path[0] === 'sessions';
}

async function proxyRequest(
  request: NextRequest,
  context: RouteContext,
  method: string,
): Promise<Response> {
  const { path } = await context.params;
  const pathStr = path.join('/');

  try {
    const cookieStore = await cookies();
    const isLogin = isLoginEndpoint(path, method);
    const token = cookieStore.get(TOKEN_COOKIE)?.value;

    if (!isLogin && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/${pathStr}${query ? `?${query}` : ''}`;

    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);

    const accept = request.headers.get('accept');
    if (accept) headers.set('Accept', accept);

    let body: ArrayBuffer | undefined;
    if (BODY_METHODS.has(method)) {
      body = await request.arrayBuffer();
    }

    const backendResponse = await fetch(url, { method, headers, body });
    const data = await backendResponse.arrayBuffer();

    const response = new NextResponse(data, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('content-type') || 'application/json',
      },
    });

    // 입장 성공 시: 응답 body의 token을 쿠키에 저장
    if (isLogin && backendResponse.ok) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(data)) as { token?: string };
        if (parsed.token) {
          response.cookies.set({
            name: TOKEN_COOKIE,
            value: parsed.token,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7일
          });
        }
      } catch {
        // token 파싱 실패는 무시 — 응답은 그대로 전달
      }
    }

    return response;
  } catch (error) {
    console.error(`[BFF Proxy] ${method} /${pathStr}:`, error);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

export const GET = (req: NextRequest, ctx: RouteContext) => proxyRequest(req, ctx, 'GET');
export const POST = (req: NextRequest, ctx: RouteContext) => proxyRequest(req, ctx, 'POST');
export const PUT = (req: NextRequest, ctx: RouteContext) => proxyRequest(req, ctx, 'PUT');
export const PATCH = (req: NextRequest, ctx: RouteContext) => proxyRequest(req, ctx, 'PATCH');
export const DELETE = (req: NextRequest, ctx: RouteContext) => proxyRequest(req, ctx, 'DELETE');
