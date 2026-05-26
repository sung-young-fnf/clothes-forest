import Phaser from 'phaser';

/**
 * 픽셀 도트 데이터를 Phaser 텍스처로 등록.
 * - pixels: 각 줄이 같은 길이의 문자열, 각 문자 = palette key
 * - '.' 또는 ' '는 transparent
 */
export function drawPixels(
  scene: Phaser.Scene,
  key: string,
  pixels: string[],
  palette: Record<string, string>,
) {
  if (scene.textures.exists(key)) return;
  const w = pixels[0].length;
  const h = pixels.length;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = pixels[y][x];
      if (ch === '.' || ch === ' ') continue;
      const hex = palette[ch];
      if (!hex) continue;
      g.fillStyle(Phaser.Display.Color.HexStringToColor(hex).color, 1);
      g.fillRect(x, y, 1, 1);
    }
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

// ─── 바닥 (마크 오크 plank 16×16) ─────────────────────────
// p = base plank, P = darker grain, L = light highlight, K = seam/edge

const FLOOR_PALETTE = {
  p: '#a76a3a',
  P: '#7a4a26',
  L: '#c98c5a',
  K: '#553015',
};

const FLOOR = [
  'pLpppPpppLppppPp',
  'pppppppppppppppp',
  'PpppLppPpppLpppp',
  'KKKKKKKKKKKKKKKK',
  'pLpppppPpLppppPp',
  'pppppppppppppppp',
  'PpppLpppppPpLppp',
  'KKKKKKKKKKKKKKKK',
  'pppPpLpppppPppLp',
  'pppppppppppppppp',
  'LppPpppPpppppPpp',
  'KKKKKKKKKKKKKKKK',
  'pPpLpppppPpLpppp',
  'pppppppppppppppp',
  'pPpLpppPppLppppP',
  'KKKKKKKKKKKKKKKK',
];

// ─── 벽 (어두운 plank 16×16) ────────────────────────────
const WALL_PALETTE = {
  w: '#6e4b30',
  W: '#4a2f1a',
  L: '#8c6342',
  K: '#3a2210',
};
const WALL = [
  'wLwwwWwwwLwwwwWw',
  'wwwwwwwwwwwwwwww',
  'WwwwLwwWwwwLwwww',
  'KKKKKKKKKKKKKKKK',
  'wLwwwwwWwLwwwwWw',
  'wwwwwwwwwwwwwwww',
  'WwwwLwwwwwWwLwww',
  'KKKKKKKKKKKKKKKK',
  'wwwWwLwwwwwWwwLw',
  'wwwwwwwwwwwwwwww',
  'LwwWwwwWwwwwwWww',
  'KKKKKKKKKKKKKKKK',
  'wWwLwwwwwWwLwwww',
  'wwwwwwwwwwwwwwww',
  'wWwLwwwWwwLwwwwW',
  'KKKKKKKKKKKKKKKK',
];

// ─── 가구 (간단 박스 16×16) ─────────────────────────────
const FURNITURE_PALETTE = {
  b: '#5a3a20',
  B: '#3a2210',
  d: '#7a5230',
  K: '#1f1208',
};
const WARDROBE = [
  'KKKKKKKKKKKKKKKK',
  'KbbbbbbbbbbbbbbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBBBBBdBBBBBBbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbBdddBdBdddBdbK',
  'KbbbbbbbbbbbbbbK',
  'KKKKKKKKKKKKKKKK',
];

const SOFA = [
  '................',
  '..KKKKKKKKKKKK..',
  '.KbBBBBBBBBBBbK.',
  'KbBdddddddddBbK.',
  'KbBdddddddddBbK.',
  'KbBdddddddddBbK.',
  'KbBdddddddddBbK.',
  'KbBBBBBBBBBBBbK.',
  'KbbbbbbbbbbbbbK.',
  'KbBBBBBBBBBBBbK.',
  'KbBdddddddddBbK.',
  'KbBdddddddddBbK.',
  'KbBdddddddddBbK.',
  'KbBBBBBBBBBBBbK.',
  '.KbbbbbbbbbbbK..',
  '..KKKKKKKKKKKK..',
];

// ─── 동물 캐릭터 16×20 (전신: 머리 + 몸 + 다리) ──────────
// K=outline, M=main, L=light, E=eye, N=nose, X=ear-inner (rabbit용)

const CHAR_BASE = [
  '................',
  '....KKKKKKKK....',
  '...KMMMMMMMMK...',
  '...KMMMMMMMMK...',
  '...KMLLLLLLMK...',
  '...KMLEMMELMK...',
  '...KMLLLNLLMK...',
  '...KMMMMMMMMK...',
  '....KKKKKKKK....',
  '....KMMMMMMK....',
  '...KMMMMMMMMK...',
  '...KMLLLLLLMK...',
  '...KMMMMMMMMK...',
  '...KMMMMMMMMK...',
  '....KMMMMMMK....',
  '.....KKKKKK.....',
  '....KK....KK....',
  '....KM....MK....',
  '....KM....MK....',
  '....KK....KK....',
];

// 토끼는 긴 귀, 고양이는 뾰족 귀, 곰은 둥근 귀 — 머리 위 2행을 동물별로 swap
const EARS = {
  dog:     '...KM....MK.....', // 처진 귀
  cat:     '...KMK..KMK.....', // 뾰족 귀
  rabbit:  '..KMK....KMK....', // 긴 귀 (2row)
  fox:     '..KMK....KMK....', // 큰 뾰족 귀
  bear:    '...KM....MK.....', // 작고 둥근 귀
  hamster: '....KMMK........', // 한쪽 작은 귀
} as const;

const EARS_ROW2 = {
  dog:     '...KMM..MMK.....',
  cat:     '...KMM..MMK.....',
  rabbit:  '..KMLK..KMLK....',
  fox:     '..KMMMKKMMMK....',
  bear:    '...KMMMMMMK.....',
  hamster: '....KMMK........',
} as const;

const ANIMAL_PALETTES: Record<string, Record<string, string>> = {
  dog: { K: '#1f1208', M: '#a86535', L: '#e5b78a', E: '#000000', N: '#1f1208' },
  cat: { K: '#1a1a1a', M: '#5a5a5a', L: '#a0a0a0', E: '#1de9b6', N: '#553333' },
  rabbit: { K: '#3a2818', M: '#f0f0f0', L: '#ffffff', E: '#3a2818', N: '#cc6677' },
  fox: { K: '#1f1208', M: '#d97030', L: '#f6d4a8', E: '#1f1208', N: '#1f1208' },
  bear: { K: '#1a0e05', M: '#5a3a1a', L: '#a87648', E: '#1a0e05', N: '#1a0e05' },
  hamster: { K: '#4a2c0a', M: '#d8a25a', L: '#f6dba8', E: '#1a0e05', N: '#1a0e05' },
};

export const ANIMAL_KEYS = {
  dog: 'tx-dog',
  cat: 'tx-cat',
  rabbit: 'tx-rabbit',
  fox: 'tx-fox',
  bear: 'tx-bear',
  hamster: 'tx-hamster',
} as const;

function buildAnimalPixels(animal: keyof typeof EARS): string[] {
  const ears1 = EARS[animal];
  const ears2 = EARS_ROW2[animal];
  // CHAR_BASE의 0번째 빈 줄을 ears1로, 1번째 outline 줄 앞에 ears2 1행 prepend → 20행 유지
  const out = [...CHAR_BASE];
  out[0] = ears1;
  // 머리 outline (row 1) 위에 ear row2를 끼우면 21행이 됨 → row 0을 ear1, row 1을 ear2로
  // 따라서 outline은 그대로 row 2부터. CHAR_BASE 그대로 두고 ears2를 row 1에 덮어쓰면 outline 사라짐.
  // 단순화: row 0=ear1, row 1=ear2, row 2~ = 기존 outline row 1~ → CHAR_BASE 첫 줄 제거 후 ears 두 줄 prepend
  return [ears1, ears2, ...CHAR_BASE.slice(1)];
}

export const TEXTURE_KEYS = {
  floor: 'tx-floor',
  wall: 'tx-wall',
  wardrobe: 'tx-wardrobe',
  sofa: 'tx-sofa',
} as const;

export function registerRoomTextures(scene: Phaser.Scene) {
  drawPixels(scene, TEXTURE_KEYS.floor, FLOOR, FLOOR_PALETTE);
  drawPixels(scene, TEXTURE_KEYS.wall, WALL, WALL_PALETTE);
  drawPixels(scene, TEXTURE_KEYS.wardrobe, WARDROBE, FURNITURE_PALETTE);
  drawPixels(scene, TEXTURE_KEYS.sofa, SOFA, FURNITURE_PALETTE);

  (Object.keys(ANIMAL_KEYS) as Array<keyof typeof ANIMAL_KEYS>).forEach((id) => {
    drawPixels(scene, ANIMAL_KEYS[id], buildAnimalPixels(id), ANIMAL_PALETTES[id]);
  });
}
