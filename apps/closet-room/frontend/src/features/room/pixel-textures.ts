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

// ─── 동물 캐릭터 28×24 (마인크래프트 베이비 큐브 스타일) ──────────
// 사진(hq720.jpg, gm684674) 기준 6종: 늑대(=dog 키), 고양이, 닭, 양, 소, 돼지
// 윤곽선 없이 색면만으로 큐브 페이스 느낌. setScale=3로 크게 표시.

type AnimalId = 'dog' | 'cat' | 'chicken' | 'sheep' | 'cow' | 'pig';
type RectPart = { x: number; y: number; w: number; h: number; c: string };

const ANIMAL_W = 28;
const ANIMAL_H = 24;

const ANIMAL_PALETTES: Record<AnimalId, Record<string, string>> = {
  // 늑대 — 흰 몸 + 진회색 페이스 마스크 + 분홍 코
  dog: {
    L: '#f0f0f0', // 흰 본체
    M: '#bababa', // 밝은 회색 하이라이트
    S: '#4a4a4a', // 진회색 (귀/다리/꼬리)
    K: '#252525', // 페이스 마스크
    P: '#d96f6f', // 분홍 코
    E: '#0a0a0a', // 검은 눈
  },
  // 고양이 — 흰 몸 + 노란 패치 + 파란 눈
  cat: {
    L: '#fafafa', // 흰 본체
    M: '#f5b94c', // 노란 패치
    S: '#d6973a', // 진노랑
    K: '#2a2a2a', // 입선 등 어두운 디테일
    P: '#ec88a3', // 분홍 코
    E: '#2f7fb8', // 파란 눈
  },
  // 닭 — 노란 큐브 + 주황 부리/발
  chicken: {
    L: '#fff48c', // 밝은 노랑 하이라이트
    M: '#f5d527', // 노랑 본체
    S: '#d9b310', // 진노랑 (날개/그림자)
    K: '#2a1a05', // 어두운 디테일
    P: '#e08a2a', // 주황 부리/발
    E: '#0a0a0a',
  },
  // 양 — 흰 양털 + 분홍 페이스 + 어두운 발굽
  sheep: {
    L: '#ffffff', // 양털 흰색
    M: '#d4d4d4', // 양털 음영
    S: '#5a5a5a', // 발굽
    K: '#1a1a1a', // 입/코 점
    P: '#e8a4a4', // 분홍 페이스
    E: '#0a0a0a',
  },
  // 소 — 흰 본체 + 갈색 점 + 뿔 + 분홍 코
  cow: {
    L: '#ffffff', // 흰 본체
    M: '#7a3f1c', // 갈색 점/페이스
    S: '#5a2c10', // 진갈색
    K: '#1a1a1a', // 발굽/디테일
    P: '#ec88a3', // 분홍 코
    E: '#0a0a0a',
    H: '#cdb88a', // 뿔 베이지
  },
  // 돼지 — 분홍 + 더 진한 코
  pig: {
    L: '#ffc8d6', // 밝은 분홍 하이라이트
    M: '#f0a0b5', // 분홍 본체
    S: '#bd6080', // 진한 분홍 (코/귀 안쪽)
    K: '#1a1a1a', // 콧구멍/발굽
    P: '#1a1a1a', // (재사용)
    E: '#0a0a0a',
  },
};

export const ANIMAL_KEYS = {
  dog: 'tx-dog',
  cat: 'tx-cat',
  chicken: 'tx-chicken',
  sheep: 'tx-sheep',
  cow: 'tx-cow',
  pig: 'tx-pig',
} as const;

function part(x: number, y: number, w: number, h: number, c: string): RectPart {
  return { x, y, w, h, c };
}

function drawRectTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  parts: RectPart[],
  palette: Record<string, string>,
) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const p of parts) {
    const hex = palette[p.c];
    if (!hex) continue;
    g.fillStyle(Phaser.Display.Color.HexStringToColor(hex).color, 1);
    g.fillRect(p.x, p.y, p.w, p.h);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}

function buildAnimalParts(animal: AnimalId): RectPart[] {
  // 모든 동물 공통 템플릿 (닭처럼 큰 얼굴 + 짧은 다리):
  //   - 본체 큐브: x=5..22 (18px), y=4..20 (17px)
  //   - 다리: y=21..22 (2px), 본체 아래에 짧게 두 개만
  //   - 얼굴 디테일은 본체 안에 페인팅
  //   - 귀/뿔은 본체 위(y=0..3)에 솟아오름
  switch (animal) {
    // ─── 늑대 (dog 키) — 흰 큐브 + 진회색 페이스 마스크 + 분홍 코 + 위로 솟은 귀 ───
    case 'dog':
      return [
        // 본체 (흰색 큐브)
        part(5, 4, 18, 17, 'L'),
        // 상단 하이라이트
        part(6, 5, 4, 2, 'M'),
        part(16, 5, 3, 2, 'M'),
        // 하단 음영
        part(5, 19, 18, 2, 'M'),
        // 귀 (위로 솟음)
        part(6, 0, 4, 5, 'S'),
        part(18, 0, 4, 5, 'S'),
        part(7, 1, 2, 3, 'K'),
        part(19, 1, 2, 3, 'K'),
        // 페이스 마스크 (눈 영역 어둡게)
        part(7, 9, 14, 4, 'K'),
        // 눈
        part(9, 10, 2, 2, 'E'),
        part(17, 10, 2, 2, 'E'),
        // 주둥이 (마스크 아래 흰색 도드라짐)
        part(10, 14, 8, 4, 'L'),
        // 코
        part(13, 16, 2, 2, 'P'),
        // 짧은 다리
        part(8, 21, 3, 2, 'S'),
        part(17, 21, 3, 2, 'S'),
      ];

    // ─── 고양이 — 흰 큐브 + 노란 패치 + 파란 눈 + 뾰족 귀 ───
    case 'cat':
      return [
        // 본체 (흰색)
        part(5, 4, 18, 17, 'L'),
        // 노란 패치 (얼굴 한쪽 + 몸 일부)
        part(5, 7, 5, 6, 'M'),
        part(16, 14, 6, 4, 'M'),
        // 상단 하이라이트
        part(15, 5, 3, 2, 'L'),
        // 하단 음영
        part(5, 19, 18, 2, 'S'),
        // 귀 (뾰족, 위로 솟음)
        part(5, 0, 4, 5, 'L'),
        part(19, 0, 4, 5, 'L'),
        part(6, 1, 2, 3, 'P'),
        part(20, 1, 2, 3, 'P'),
        // 눈 (파랑)
        part(9, 9, 2, 3, 'E'),
        part(17, 9, 2, 3, 'E'),
        // 코
        part(13, 13, 2, 2, 'P'),
        // 입선
        part(11, 15, 6, 1, 'K'),
        // 짧은 다리
        part(8, 21, 3, 2, 'L'),
        part(17, 21, 3, 2, 'L'),
      ];

    // ─── 닭 — 노란 큐브 + 주황 부리 + 까만 눈 (템플릿 원본) ───
    case 'chicken':
      return [
        // 본체 (노란 큐브)
        part(5, 4, 18, 17, 'M'),
        // 상단 하이라이트
        part(6, 5, 4, 3, 'L'),
        part(15, 5, 3, 2, 'L'),
        // 하단 음영
        part(5, 18, 18, 3, 'S'),
        // 날개 (양옆 어두운 노랑)
        part(5, 11, 3, 5, 'S'),
        part(20, 11, 3, 5, 'S'),
        // 눈
        part(10, 9, 2, 3, 'E'),
        part(16, 9, 2, 3, 'E'),
        // 부리
        part(12, 13, 5, 3, 'P'),
        part(13, 16, 3, 1, 'K'),
        // 짧은 다리 (주황)
        part(8, 21, 3, 2, 'P'),
        part(17, 21, 3, 2, 'P'),
      ];

    // ─── 양 — 흰 양털 큐브 + 분홍 페이스 패널 + 양옆 분홍 귀 ───
    case 'sheep':
      return [
        // 본체 (양털 흰색)
        part(5, 4, 18, 17, 'L'),
        // 양털 텍스처 (둥글둥글한 음영 점)
        part(6, 5, 2, 2, 'M'),
        part(15, 5, 3, 2, 'M'),
        part(7, 18, 3, 2, 'M'),
        part(17, 18, 3, 2, 'M'),
        // 귀 (양옆으로 돌출)
        part(3, 9, 3, 4, 'P'),
        part(22, 9, 3, 4, 'P'),
        // 얼굴 패널 (분홍, 중앙)
        part(9, 9, 10, 9, 'P'),
        // 눈
        part(11, 11, 2, 2, 'E'),
        part(15, 11, 2, 2, 'E'),
        // 코 점
        part(13, 15, 2, 1, 'K'),
        // 짧은 다리 (어두움)
        part(8, 21, 3, 2, 'S'),
        part(17, 21, 3, 2, 'S'),
      ];

    // ─── 소 — 흰 큐브 + 갈색 점들 + 위로 솟은 뿔 + 분홍 코 ───
    case 'cow':
      return [
        // 본체 (흰색)
        part(5, 4, 18, 17, 'L'),
        // 갈색 점 (4곳에 흩뿌림)
        part(5, 5, 5, 4, 'M'),
        part(16, 5, 5, 3, 'M'),
        part(6, 17, 4, 3, 'M'),
        part(17, 16, 5, 4, 'M'),
        // 얼굴 갈색 패치 (코 주변)
        part(8, 11, 12, 7, 'M'),
        // 얼굴 흰 블레이즈 (가운데 세로)
        part(12, 12, 4, 4, 'L'),
        // 뿔 (위로)
        part(6, 1, 2, 3, 'H'),
        part(20, 1, 2, 3, 'H'),
        // 귀 (뿔 옆 작은 갈색)
        part(4, 7, 2, 3, 'M'),
        part(22, 7, 2, 3, 'M'),
        // 눈
        part(9, 13, 2, 2, 'E'),
        part(17, 13, 2, 2, 'E'),
        // 코 (분홍)
        part(11, 16, 6, 2, 'P'),
        // 콧구멍
        part(12, 17, 1, 1, 'K'),
        part(15, 17, 1, 1, 'K'),
        // 짧은 발굽
        part(8, 21, 3, 2, 'K'),
        part(17, 21, 3, 2, 'K'),
      ];

    // ─── 돼지 — 분홍 큐브 + 진한 분홍 코 + 작은 귀 ───
    case 'pig':
      return [
        // 본체 (분홍)
        part(5, 4, 18, 17, 'M'),
        // 상단 하이라이트
        part(6, 5, 4, 3, 'L'),
        part(15, 5, 3, 2, 'L'),
        // 하단 음영
        part(5, 18, 18, 3, 'S'),
        // 귀 (위로 솟음, 진한 분홍)
        part(6, 0, 4, 5, 'S'),
        part(18, 0, 4, 5, 'S'),
        // 눈
        part(9, 9, 2, 2, 'E'),
        part(17, 9, 2, 2, 'E'),
        // 코 (진한 분홍 큰 직사각형)
        part(10, 13, 8, 5, 'S'),
        // 콧구멍 2개
        part(12, 15, 1, 2, 'K'),
        part(15, 15, 1, 2, 'K'),
        // 짧은 발굽
        part(8, 21, 3, 2, 'K'),
        part(17, 21, 3, 2, 'K'),
      ];
  }
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

  (Object.keys(ANIMAL_KEYS) as AnimalId[]).forEach((id) => {
    drawRectTexture(
      scene,
      ANIMAL_KEYS[id],
      ANIMAL_W,
      ANIMAL_H,
      buildAnimalParts(id),
      ANIMAL_PALETTES[id],
    );
  });
}
