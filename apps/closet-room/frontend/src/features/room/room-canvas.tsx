'use client';

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import {
  CANVAS_H,
  CANVAS_W,
  createGameConfig,
  PeerEntry,
  ROOM_EVENTS,
  RoomScene,
} from './room-scene';

export interface RoomCanvasApi {
  showBubble: RoomScene['showBubble'];
}

interface RoomCanvasProps {
  socket: Socket | null;
  nickname: string;
  characterId: string;
  onReady?: (api: RoomCanvasApi) => void;
}

export default function RoomCanvas({ socket, nickname, characterId, onReady }: RoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<import('phaser').Game | null>(null);
  const sceneRef = useRef<RoomScene | null>(null);

  // 1. Phaser game 부팅 (nickname/characterId 변경 시 재생성)
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const Phaser = (await import('phaser')).default;
      if (cancelled || !containerRef.current) return;
      const config = createGameConfig(containerRef.current);
      const game = new Phaser.Game(config);
      gameRef.current = game;

      // Phaser 부팅이 끝난 뒤에 scene 등록 (game.scene.add는 부팅 전엔 null 반환)
      game.events.once(Phaser.Core.Events.READY, () => {
        if (cancelled || !gameRef.current) return;
        const scene = game.scene.add(
          'RoomScene',
          RoomScene,
          true,
          { nickname, characterId },
        ) as RoomScene | null;
        if (!scene) {
          console.error('[room-canvas] RoomScene add failed');
          return;
        }
        sceneRef.current = scene;
        onReady?.({ showBubble: scene.showBubble.bind(scene) });
      });
    })();

    return () => {
      cancelled = true;
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [nickname, characterId, onReady]);

  // 2. socket과 scene 이벤트 연결 (socket이 mount된 후에)
  useEffect(() => {
    if (!socket) return;
    const scene = sceneRef.current;
    if (!scene) return;

    const onSceneReady = (pos: { col: number; row: number }) => {
      socket.emit('join', pos, (ack?: { peers: PeerEntry[] }) => {
        for (const peer of ack?.peers ?? []) scene.addPeer(peer);
      });
    };
    const onMoved = (pos: { col: number; row: number }) => socket.emit('move', pos);
    const onJoined = (peer: PeerEntry) => scene.addPeer(peer);
    const onPeerMoved = (data: { deviceId: string; col: number; row: number }) =>
      scene.movePeer(data.deviceId, data.col, data.row);
    const onLeft = (data: { deviceId: string }) => scene.removePeer(data.deviceId);

    scene.events.on(ROOM_EVENTS.ready, onSceneReady);
    scene.events.on(ROOM_EVENTS.moved, onMoved);
    socket.on('user:joined', onJoined);
    socket.on('user:moved', onPeerMoved);
    socket.on('user:left', onLeft);

    // scene이 이미 ready된 경우(useEffect 순서) — 즉시 join
    // ROOM_EVENTS.ready는 scene.create()에서 1회 emit이므로 늦게 붙으면 놓침
    // sceneRef가 set된 직후 join을 한 번 시도
    socket.emit('join', { col: 12, row: 10 }, (ack?: { peers: PeerEntry[] }) => {
      for (const peer of ack?.peers ?? []) scene.addPeer(peer);
    });

    return () => {
      scene.events.off(ROOM_EVENTS.ready, onSceneReady);
      scene.events.off(ROOM_EVENTS.moved, onMoved);
      socket.off('user:joined', onJoined);
      socket.off('user:moved', onPeerMoved);
      socket.off('user:left', onLeft);
    };
  }, [socket]);

  return (
    <div
      ref={containerRef}
      style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}
      className="overflow-hidden rounded-lg shadow-lg"
    />
  );
}
