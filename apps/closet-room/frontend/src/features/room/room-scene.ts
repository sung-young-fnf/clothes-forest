import Phaser from 'phaser';
import { ANIMAL_KEYS, registerRoomTextures, TEXTURE_KEYS } from './pixel-textures';

export const TILE = 32;
export const GRID_W = 24;
export const GRID_H = 16;
export const CANVAS_W = TILE * GRID_W; // 768
export const CANVAS_H = TILE * GRID_H; // 512
export const WALL_ROWS = 4;

function characterTexture(characterId: string): string {
  return (ANIMAL_KEYS as Record<string, string>)[characterId] ?? ANIMAL_KEYS.dog;
}

export interface RoomSceneInit {
  nickname: string;
  characterId: string;
}

export interface PeerEntry {
  deviceId: string;
  nickname: string;
  characterId: string;
  col: number;
  row: number;
}

interface PeerGraphics {
  char: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

/** Scene이 발생시키는 이벤트 — 외부(React)가 socket으로 forward */
export const ROOM_EVENTS = {
  ready: 'room:ready',
  moved: 'room:moved',
} as const;

// 가구 배치 (x, y, w, h 단위는 grid cell)
type Furniture = { x: number; y: number; w: number; h: number; kind: 'wardrobe' | 'sofa' };
const FURNITURE: Furniture[] = [
  { x: 2, y: 4, w: 3, h: 2, kind: 'wardrobe' },
  { x: 9, y: 4, w: 4, h: 2, kind: 'wardrobe' },
  { x: 18, y: 4, w: 3, h: 2, kind: 'wardrobe' },
  { x: 6, y: 11, w: 4, h: 2, kind: 'sofa' },
  { x: 14, y: 11, w: 3, h: 2, kind: 'sofa' },
];

const MOVE_COOLDOWN_MS = 140;

function buildBlockedCells(): Set<string> {
  const set = new Set<string>();
  for (const f of FURNITURE) {
    for (let dx = 0; dx < f.w; dx++) {
      for (let dy = 0; dy < f.h; dy++) {
        set.add(`${f.x + dx},${f.y + dy}`);
      }
    }
  }
  return set;
}
const BLOCKED = buildBlockedCells();

function isWalkable(col: number, row: number): boolean {
  if (col < 0 || col >= GRID_W) return false;
  if (row < WALL_ROWS || row >= GRID_H) return false;
  if (BLOCKED.has(`${col},${row}`)) return false;
  return true;
}

export class RoomScene extends Phaser.Scene {
  private myNickname = '';
  private myCharacterId = 'dog';
  private myChar?: Phaser.GameObjects.Sprite;
  private myLabel?: Phaser.GameObjects.Text;
  private myCol = Math.floor(GRID_W / 2);
  private myRow = Math.floor(GRID_H / 2) + 2;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private nextMoveAt = 0;
  private peers = new Map<string, PeerGraphics>(); // key: deviceId

  constructor() {
    super({ key: 'RoomScene' });
  }

  init(data: RoomSceneInit) {
    this.myNickname = data.nickname;
    this.myCharacterId = data.characterId;
  }

  create() {
    registerRoomTextures(this);
    this.drawFloor();
    this.drawWall();
    this.drawFurniture();
    this.drawMyCharacter();

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
      // 입력칸이 포커스일 땐 게임이 키 이벤트를 가로채지 않도록
      this.input.keyboard.disableGlobalCapture();
    }

    // 외부(React)에게 초기 위치 전달 — socket join 발사용
    this.events.emit(ROOM_EVENTS.ready, { col: this.myCol, row: this.myRow });
  }

  update(time: number) {
    if (time < this.nextMoveAt) return;
    const dir = this.readDirection();
    if (!dir) return;
    const nextCol = this.myCol + dir.dx;
    const nextRow = this.myRow + dir.dy;
    if (!isWalkable(nextCol, nextRow)) return;
    this.myCol = nextCol;
    this.myRow = nextRow;
    this.positionMyCharacter();
    this.nextMoveAt = time + MOVE_COOLDOWN_MS;
    this.events.emit(ROOM_EVENTS.moved, { col: this.myCol, row: this.myRow });
  }

  // ─── Peer 관리 (외부에서 호출) ─────────────────────────

  addPeer(peer: PeerEntry) {
    if (this.peers.has(peer.deviceId)) {
      this.movePeer(peer.deviceId, peer.col, peer.row);
      return;
    }
    const cx = peer.col * TILE + TILE / 2;
    const baseY = (peer.row + 1) * TILE - 2;
    const char = this.add
      .sprite(cx, baseY, characterTexture(peer.characterId))
      .setOrigin(0.5, 1)
      .setScale(2);
    const label = this.add
      .text(cx, baseY - 44, peer.nickname, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      })
      .setOrigin(0.5, 1);
    this.peers.set(peer.deviceId, { char, label });
  }

  movePeer(deviceId: string, col: number, row: number) {
    const g = this.peers.get(deviceId);
    if (!g) return;
    const cx = col * TILE + TILE / 2;
    const baseY = (row + 1) * TILE - 2;
    g.char.setPosition(cx, baseY);
    g.label.setPosition(cx, baseY - 44);
  }

  removePeer(deviceId: string) {
    const g = this.peers.get(deviceId);
    if (!g) return;
    g.char.destroy();
    g.label.destroy();
    this.peers.delete(deviceId);
  }

  /** 머리 위 채팅 말풍선 — 3초 후 페이드. self=true면 내 캐릭터 위에 표시. */
  showBubble(opts: { deviceId: string; content: string; self?: boolean }) {
    const truncated = opts.content.length > 40 ? `${opts.content.slice(0, 40)}…` : opts.content;
    let anchorChar: Phaser.GameObjects.Sprite | undefined;
    if (opts.self) anchorChar = this.myChar;
    else anchorChar = this.peers.get(opts.deviceId)?.char;
    if (!anchorChar) return;

    const bubbleY = anchorChar.y - anchorChar.displayHeight - 8;
    const bubble = this.add
      .text(anchorChar.x, bubbleY, truncated, {
        fontSize: '12px',
        color: '#1f2937',
        backgroundColor: '#ffffff',
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
        wordWrap: { width: 200 },
      })
      .setOrigin(0.5, 1)
      .setDepth(100);

    this.tweens.add({
      targets: bubble,
      alpha: 0,
      delay: 2400,
      duration: 600,
      onComplete: () => bubble.destroy(),
    });
  }

  private readDirection(): { dx: number; dy: number } | null {
    // 채팅 input 등에 포커스가 있으면 이동 키 무시
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active) {
      const tag = active.tagName;
      const editable = (active as HTMLElement).isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) {
        return null;
      }
    }
    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S.isDown;
    if (left) return { dx: -1, dy: 0 };
    if (right) return { dx: 1, dy: 0 };
    if (up) return { dx: 0, dy: -1 };
    if (down) return { dx: 0, dy: 1 };
    return null;
  }

  private positionMyCharacter() {
    if (!this.myChar || !this.myLabel) return;
    const cx = this.myCol * TILE + TILE / 2;
    const baseY = (this.myRow + 1) * TILE - 2;
    this.myChar.setPosition(cx, baseY);
    this.myLabel.setPosition(cx, baseY - 44);
  }

  private drawFloor() {
    // 오크 plank 텍스처 16×16 → 2배 scale로 cell당 32×32 반복
    const floorH = CANVAS_H - WALL_ROWS * TILE;
    this.add
      .tileSprite(0, WALL_ROWS * TILE, CANVAS_W, floorH, TEXTURE_KEYS.floor)
      .setOrigin(0, 0)
      .setTileScale(2, 2);
  }

  private drawWall() {
    this.add
      .tileSprite(0, 0, CANVAS_W, WALL_ROWS * TILE, TEXTURE_KEYS.wall)
      .setOrigin(0, 0)
      .setTileScale(2, 2);

    // 걸레받이 — 어두운 띠
    const g = this.add.graphics();
    g.fillStyle(0x2a1808, 1);
    g.fillRect(0, WALL_ROWS * TILE - 2, CANVAS_W, 2);
  }

  private drawFurniture() {
    for (const f of FURNITURE) {
      const texKey = f.kind === 'wardrobe' ? TEXTURE_KEYS.wardrobe : TEXTURE_KEYS.sofa;
      this.add
        .tileSprite(f.x * TILE, f.y * TILE, f.w * TILE, f.h * TILE, texKey)
        .setOrigin(0, 0)
        .setTileScale(2, 2);
    }
  }

  private drawMyCharacter() {
    const cx = this.myCol * TILE + TILE / 2;
    const baseY = (this.myRow + 1) * TILE - 2; // 셀 바닥 기준 (살짝 띄움)

    this.myChar = this.add
      .sprite(cx, baseY, characterTexture(this.myCharacterId))
      .setOrigin(0.5, 1)
      .setScale(2);

    this.myLabel = this.add
      .text(cx, baseY - 44, this.myNickname, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      })
      .setOrigin(0.5, 1);
  }
}

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#3b2a1a',
    pixelArt: true,
    // scene은 game.scene.add()로 동기 등록 → 즉시 getScene 가능
    scene: [],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
}
