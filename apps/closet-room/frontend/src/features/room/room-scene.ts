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
const CHARACTER_SCALE = 3;
const LABEL_GAP = 6;

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
  private nextMoveAt = 0;
  private peers = new Map<string, PeerGraphics>(); // key: deviceId
  private pressedKeys = new Set<string>();
  private readonly movementKeys = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowLeft',
    'ArrowDown',
    'ArrowRight',
  ]);
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.movementKeys.has(event.code) || this.isTypingTarget(event.target)) return;
    this.pressedKeys.add(event.code);
    event.preventDefault();
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (!this.movementKeys.has(event.code)) return;
    this.pressedKeys.delete(event.code);
    if (!this.isTypingTarget(event.target)) event.preventDefault();
  };
  private readonly clearPressedKeys = () => {
    this.pressedKeys.clear();
  };

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
      // 입력칸이 포커스일 땐 게임이 키 이벤트를 가로채지 않도록
      this.input.keyboard.disableGlobalCapture();
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearPressedKeys);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeKeyboardListeners, this);
  }

  update(time: number) {
    // 매 프레임 이름표를 캐릭터(tween 이동 중)에 맞춰 따라가게 함
    this.syncLabels();

    if (time < this.nextMoveAt) return;
    const dir = this.readDirection();
    if (!dir) return;

    // 대각 이동을 먼저 시도하고, 벽/가구에 막히면 한 축씩 슬라이드
    const diagonal = dir.dx !== 0 && dir.dy !== 0;
    const moved =
      this.tryStep(dir.dx, dir.dy) ||
      (diagonal && this.tryStep(dir.dx, 0)) ||
      (diagonal && this.tryStep(0, dir.dy));
    if (!moved) return;

    this.nextMoveAt = time + MOVE_COOLDOWN_MS;
    this.events.emit(ROOM_EVENTS.moved, { col: this.myCol, row: this.myRow });
  }

  /** 한 칸 이동 시도 — 목표 셀이 walkable이면 이동·tween 후 true */
  private tryStep(dx: number, dy: number): boolean {
    if (dx === 0 && dy === 0) return false;
    const nextCol = this.myCol + dx;
    const nextRow = this.myRow + dy;
    if (!isWalkable(nextCol, nextRow)) return false;
    this.myCol = nextCol;
    this.myRow = nextRow;
    this.tweenCharTo(this.myChar, this.myCol, this.myRow);
    return true;
  }

  /** 현재 내 캐릭터 셀 위치 (socket join 시 사용) */
  getPosition(): { col: number; row: number } {
    return { col: this.myCol, row: this.myRow };
  }

  // ─── Peer 관리 (외부에서 호출) ─────────────────────────

  addPeer(peer: PeerEntry) {
    if (this.peers.has(peer.deviceId)) {
      this.movePeer(peer.deviceId, peer.col, peer.row);
      return;
    }
    const { x: cx, y: baseY } = this.cellToXY(peer.col, peer.row);
    const char = this.add
      .sprite(cx, baseY, characterTexture(peer.characterId))
      .setOrigin(0.5, 1)
      .setScale(CHARACTER_SCALE);
    const label = this.add
      .text(cx, this.labelY(char), peer.nickname, {
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
    // 다른 사람 캐릭터도 셀 사이를 부드럽게 보간 이동 (label은 update에서 따라감)
    this.tweenCharTo(g.char, col, row);
  }

  removePeer(deviceId: string) {
    const g = this.peers.get(deviceId);
    if (!g) return;
    this.tweens.killTweensOf(g.char);
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
    if (this.isTypingTarget(document.activeElement)) {
      this.pressedKeys.clear();
      return null;
    }
    const left = this.pressedKeys.has('ArrowLeft') || this.pressedKeys.has('KeyA');
    const right = this.pressedKeys.has('ArrowRight') || this.pressedKeys.has('KeyD');
    const up = this.pressedKeys.has('ArrowUp') || this.pressedKeys.has('KeyW');
    const down = this.pressedKeys.has('ArrowDown') || this.pressedKeys.has('KeyS');

    // 두 축을 합쳐 대각 이동 허용 (예: 위+오른쪽 = {dx:1, dy:-1})
    let dx = 0;
    let dy = 0;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private removeKeyboardListeners() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearPressedKeys);
    this.pressedKeys.clear();
  }

  /** 셀 좌표(col,row) → 픽셀 좌표. 캐릭터 origin은 (0.5, 1) = 발밑 기준 */
  private cellToXY(col: number, row: number): { x: number; y: number } {
    return { x: col * TILE + TILE / 2, y: (row + 1) * TILE - 2 };
  }

  /** 캐릭터를 목표 셀로 부드럽게 보간 이동 (진행 중 tween은 중단 후 재시작) */
  private tweenCharTo(char: Phaser.GameObjects.Sprite | undefined, col: number, row: number) {
    if (!char) return;
    const { x, y } = this.cellToXY(col, row);
    this.tweens.killTweensOf(char);
    this.tweens.add({ targets: char, x, y, duration: MOVE_COOLDOWN_MS, ease: 'Linear' });
  }

  /** 이름표를 캐릭터 머리 위로 따라붙임 (tween 이동 중에도 매 프레임 동기화) */
  private syncLabels() {
    if (this.myChar && this.myLabel) {
      this.myLabel.setPosition(this.myChar.x, this.labelY(this.myChar));
    }
    for (const { char, label } of this.peers.values()) {
      label.setPosition(char.x, this.labelY(char));
    }
  }

  private labelY(char: Phaser.GameObjects.Sprite): number {
    return char.y - char.displayHeight - LABEL_GAP;
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
      .setScale(CHARACTER_SCALE);

    this.myLabel = this.add
      .text(cx, this.labelY(this.myChar), this.myNickname, {
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
