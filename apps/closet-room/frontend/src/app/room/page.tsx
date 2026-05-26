'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { io, type Socket } from 'socket.io-client';
import ChatPanel, { type ChatMessage } from '@/features/chat/chat-panel';
import SearchStartModal from '@/features/browse/search-start-modal';
import type { RoomCanvasApi } from '@/features/room/room-canvas';

const RoomCanvas = dynamic(() => import('@/features/room/room-canvas'), { ssr: false });

type Session = {
  deviceId: string;
  nickname: string;
  characterId: string;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export default function RoomPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myBrowseSessionId, setMyBrowseSessionId] = useState<string | null>(null);
  const [activeHost, setActiveHost] = useState<{ deviceId: string; nickname: string } | null>(null);
  const [pairNonce, setPairNonce] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const apiRef = useRef<RoomCanvasApi | null>(null);

  // 1) 본인 세션 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/sessions/me');
        if (res.status === 401) {
          router.replace('/');
          return;
        }
        if (!res.ok) throw new Error(`세션 조회 실패 (HTTP ${res.status})`);
        const data: Session = await res.json();
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '알 수 없는 오류');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 2) WS ticket + socket 연결
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let s: Socket | null = null;

    (async () => {
      try {
        const ticketRes = await fetch('/api/v1/sessions/ws-ticket');
        if (!ticketRes.ok) throw new Error(`ws-ticket ${ticketRes.status}`);
        const { token } = (await ticketRes.json()) as { token: string };
        if (cancelled) return;
        s = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
        if (cancelled) {
          s.disconnect();
          return;
        }
        setSocket(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'socket 연결 실패');
      }
    })();

    return () => {
      cancelled = true;
      s?.disconnect();
      setSocket(null);
    };
  }, [session]);

  const handleRoomReady = useCallback((api: RoomCanvasApi) => {
    apiRef.current = api;
  }, []);

  // browse:* 이벤트 구독
  useEffect(() => {
    if (!socket || !session) return;
    const onStart = (e: { browseSessionId: string; hostDeviceId: string; hostNickname: string }) => {
      setActiveHost({ deviceId: e.hostDeviceId, nickname: e.hostNickname });
      if (e.hostDeviceId === session.deviceId) setMyBrowseSessionId(e.browseSessionId);
    };
    const onEnd = (e: { browseSessionId: string }) => {
      setActiveHost(null);
      setMyBrowseSessionId((cur) => (cur === e.browseSessionId ? null : cur));
    };
    socket.on('browse:start', onStart);
    socket.on('browse:end', onEnd);
    return () => {
      socket.off('browse:start', onStart);
      socket.off('browse:end', onEnd);
    };
  }, [socket, session]);

  const startSearch = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/v1/browse-sessions', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: string; nonce: string };
      setMyBrowseSessionId(data.id);
      setPairNonce(data.nonce);
    } catch (e) {
      alert(e instanceof Error ? e.message : '검색 시작 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const endSearch = async () => {
    if (!myBrowseSessionId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/browse-sessions/${myBrowseSessionId}/end`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMyBrowseSessionId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '검색 종료 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const isHost = activeHost?.deviceId === session?.deviceId;
  const isOtherHostBusy = activeHost !== null && !isHost;

  const handleIncomingMessage = useCallback(
    (msg: ChatMessage) => {
      if (msg.senderType === 'system') return;
      const self = msg.deviceId === session?.deviceId;
      apiRef.current?.showBubble({
        deviceId: msg.deviceId ?? '',
        content: msg.content,
        self,
      });
    },
    [session?.deviceId],
  );

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="space-y-3 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => router.replace('/')} className="text-sm underline">
            다시 입장하기
          </button>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">방으로 들어가는 중…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-gray-100 px-4 py-6 lg:flex-row lg:items-start lg:justify-center">
      <section className="flex flex-col items-center gap-2">
        <header className="flex w-full max-w-2xl items-center justify-between">
          <div className="text-left">
            <h1 className="text-lg font-bold">Closet Room</h1>
            <p className="text-xs text-gray-500">방향키 / WASD로 이동, 우측에서 채팅</p>
          </div>
          {isHost ? (
            <button
              onClick={endSearch}
              disabled={actionLoading}
              className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              쇼핑 종료
            </button>
          ) : (
            <button
              onClick={startSearch}
              disabled={actionLoading || isOtherHostBusy}
              title={isOtherHostBusy ? `${activeHost?.nickname}님이 쇼핑 중` : ''}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
            >
              {isOtherHostBusy ? `${activeHost?.nickname}님 쇼핑 중` : '검색 시작'}
            </button>
          )}
        </header>
        <RoomCanvas
          socket={socket}
          nickname={session.nickname}
          characterId={session.characterId}
          onReady={handleRoomReady}
        />
      </section>
      <ChatPanel
        socket={socket}
        myDeviceId={session.deviceId}
        onIncomingMessage={handleIncomingMessage}
      />
      {pairNonce && <SearchStartModal nonce={pairNonce} onClose={() => setPairNonce(null)} />}
    </main>
  );
}
