'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 text-center shadow-sm">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">로그인</h1>
          <p className="text-sm text-gray-500">계정으로 로그인하세요</p>
        </header>

        <button
          type="button"
          onClick={() => signIn('microsoft-entra-id', { callbackUrl: '/admin/users' })}
          className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-medium text-gray-800 transition hover:border-gray-900 hover:text-gray-900"
        >
          Azure Active Directory로 로그인
        </button>

        <p className="text-[11px] text-gray-400">
          익명으로 방에 입장하려면{' '}
          <a href="/" className="underline">
            메인으로
          </a>
        </p>
      </div>
    </main>
  );
}
