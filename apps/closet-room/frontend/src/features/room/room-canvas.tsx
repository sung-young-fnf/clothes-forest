'use client';

import { useEffect, useRef, useState } from 'react';
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
  // scene이 비동기로 준비되므로 socket effect가 재실행되도록 state로 노출
  const [sceneReady, setSceneReady] = useState(false);

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
        setSceneReady(true);
        onReady?.({ showBubble: scene.showBubble.bind(scene) });
      });
    })();

    return () => {
      cancelled = true;
      sceneRef.current = null;
      setSceneReady(false);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [nickname, characterId, onReady]);

  // 2. socket과 scene 이벤트 연결 — socket·scene 둘 다 준비된 뒤 실행
  //    (scene은 비동기 부팅이라 sceneReady state를 deps에 넣어 순서 무관하게 보장)
  useEffect(() => {
    if (!socket || !sceneReady) return;
    const scene = sceneRef.current;
    if (!scene) return;

    const onMoved = (pos: { col: number; row: number }) => socket.emit('move', pos);
    const onJoined = (peer: PeerEntry) => scene.addPeer(peer);
    const onPeerMoved = (data: { deviceId: string; col: number; row: number }) =>
      scene.movePeer(data.deviceId, data.col, data.row);
    const onLeft = (data: { deviceId: string }) => scene.removePeer(data.deviceId);

    scene.events.on(ROOM_EVENTS.moved, onMoved);
    socket.on('user:joined', onJoined);
    socket.on('user:moved', onPeerMoved);
    socket.on('user:left', onLeft);

    // 입장 — 서버는 ack로 기존 접속자(peers) 목록을 돌려주고,
    // 다른 사람들에겐 user:joined 를 broadcast 한다.
    socket.emit('join', scene.getPosition(), (ack?: { peers: PeerEntry[] }) => {
      for (const peer of ack?.peers ?? []) scene.addPeer(peer);
    });

    return () => {
      scene.events.off(ROOM_EVENTS.moved, onMoved);
      socket.off('user:joined', onJoined);
      socket.off('user:moved', onPeerMoved);
      socket.off('user:left', onLeft);
    };
  }, [socket, sceneReady]);

  return (
    <div
      ref={containerRef}
      style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%' }}
      className="overflow-hidden rounded-lg shadow-lg"
    />
  );
}
