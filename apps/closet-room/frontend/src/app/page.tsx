'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CHARACTERS = [
  { id: 'dog', label: '강아지', emoji: '🐶' },
  { id: 'cat', label: '고양이', emoji: '🐱' },
  { id: 'rabbit', label: '토끼', emoji: '🐰' },
  { id: 'fox', label: '여우', emoji: '🦊' },
  { id: 'bear', label: '곰', emoji: '🐻' },
  { id: 'hamster', label: '햄스터', emoji: '🐹' },
] as const;

type CharacterId = (typeof CHARACTERS)[number]['id'];

export default function EntryPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [characterId, setCharacterId] = useState<CharacterId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = nickname.trim().length >= 2 && nickname.trim().length <= 12 && characterId !== null && !loading;

  const handleEnter = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), characterId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message?.[0] ?? data.error ?? `입장 실패 (HTTP ${res.status})`);
      }
      router.push('/room');
    } catch (e) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Closet Room</h1>
          <p className="text-sm text-gray-500">닉네임과 동물을 골라 입장하세요</p>
        </header>

        <div className="space-y-2">
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
            닉네임
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
            placeholder="2~12자"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">캐릭터 선택</label>
          <div className="grid grid-cols-3 gap-2">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCharacterId(c.id)}
                aria-pressed={characterId === c.id}
                className={`flex flex-col items-center gap-1 rounded-md border-2 py-3 transition ${
                  characterId === c.id
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs text-gray-700">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleEnter}
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? '입장 중…' : '입장하기'}
        </button>
      </div>
    </main>
  );
}
