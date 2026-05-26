'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  deviceId: string | null;
  nickname: string | null;
  senderType: 'user' | 'claude' | 'system';
  content: string;
  kind: string;
  metadata?: string | null;
  createdAt: string;
}

interface PageCardMeta {
  browseSessionId?: string;
  url?: string;
  ogImageUrl?: string;
  siteName?: string;
  priceText?: string;
}

function parseMeta(raw?: string | null): PageCardMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PageCardMeta;
  } catch {
    return null;
  }
}

interface ChatPanelProps {
  socket: Socket | null;
  myDeviceId: string;
  onIncomingMessage?: (msg: ChatMessage) => void; // 말풍선 등 외부 hook
}

const CHARACTERS = [
  { id: 'dog', emoji: '🐶' },
  { id: 'cat', emoji: '🐱' },
  { id: 'rabbit', emoji: '🐰' },
  { id: 'fox', emoji: '🦊' },
  { id: 'bear', emoji: '🐻' },
  { id: 'hamster', emoji: '🐹' },
];

const EMOJI: Record<string, string> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c.emoji]));

export default function ChatPanel({ socket, myDeviceId, onIncomingMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 최근 메시지 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/chat/recent?limit=50');
        if (!res.ok) return;
        const data = (await res.json()) as ChatMessage[];
        if (!cancelled) setMessages(data);
      } catch {
        // 무시 — 실시간만으로도 동작
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 실시간 chat:new 구독
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg].slice(-200));
      onIncomingMessage?.(msg);
    };
    socket.on('chat:new', handler);
    return () => {
      socket.off('chat:new', handler);
    };
  }, [socket, onIncomingMessage]);

  // 자동 스크롤
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !socket || sending) return;
    setSending(true);
    socket.emit('chat:send', { content }, (ack?: { ok: boolean; reason?: string }) => {
      setSending(false);
      if (ack?.ok === false) {
        // rate_limited / invalid_length 등 — 인풋 유지하고 메시지 표시
        const label = ack.reason === 'rate_limited' ? '잠깐 천천히 보내주세요' : '메시지를 확인해주세요';
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            deviceId: null,
            nickname: null,
            senderType: 'system',
            content: label,
            kind: 'system',
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        setInput('');
      }
    });
  };

  return (
    <aside className="flex w-80 flex-col gap-3 rounded-lg bg-white p-3 shadow-lg">
      {/* 상단: 캐릭터 변경 placeholder (V1.5에서 활성화) */}
      <header className="space-y-2 border-b border-gray-100 pb-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>캐릭터 변경 (V1.5)</span>
          <span>이름 변경 (V1.5)</span>
        </div>
        <div className="flex justify-between">
          {CHARACTERS.map((c) => (
            <span key={c.id} className="text-xl opacity-50" title={c.id}>
              {c.emoji}
            </span>
          ))}
        </div>
      </header>

      {/* 채팅 리스트 */}
      <div
        ref={listRef}
        className="flex h-80 flex-col gap-2 overflow-y-auto pr-1 text-sm"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="my-auto text-center text-xs text-gray-400">첫 메시지를 남겨보세요</p>
        )}
        {messages.map((m) => {
          if (m.kind === 'page_card') {
            const meta = parseMeta(m.metadata);
            return (
              <a
                key={m.id}
                href={meta?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2 rounded-md border border-gray-200 bg-white p-2 transition hover:border-gray-400"
              >
                {meta?.ogImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.ogImageUrl}
                    alt=""
                    className="h-14 w-14 flex-shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase text-gray-400">
                    {meta?.siteName ?? '쇼핑몰'} · {m.nickname}님이 보는 중
                  </p>
                  <p className="line-clamp-2 text-[12px] font-semibold text-gray-900">
                    {m.content}
                  </p>
                  {meta?.priceText && (
                    <p className="text-[11px] text-rose-700">{meta.priceText}</p>
                  )}
                </div>
              </a>
            );
          }
          if (m.senderType === 'system') {
            return (
              <p key={m.id} className="text-center text-[11px] text-gray-400">
                {m.content}
              </p>
            );
          }
          const isMine = m.deviceId === myDeviceId;
          return (
            <div key={m.id} className={`flex items-start gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              <span className="text-lg leading-none">
                {m.senderType === 'claude' ? '🤖' : EMOJI[m.nickname ? '' : ''] ?? '🐾'}
              </span>
              <div className={`max-w-[70%] ${isMine ? 'text-right' : ''}`}>
                <p className="text-[11px] text-gray-500">{m.nickname ?? 'Claude'}</p>
                <p
                  className={`mt-0.5 inline-block rounded-lg px-2 py-1 text-[13px] ${
                    isMine ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {m.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 입력 */}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="메시지를 입력하세요"
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || !socket || sending}
          className="rounded-md bg-gray-900 px-3 text-sm font-semibold text-white disabled:bg-gray-300"
        >
          보내기
        </button>
      </form>
    </aside>
  );
}
