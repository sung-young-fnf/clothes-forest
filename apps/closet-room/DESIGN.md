# closet-room Design System

> AI 에이전트가 읽고 일관된 UI를 생성하기 위한 디자인 시스템 문서
> 참고: https://github.com/VoltAgent/awesome-design-md

## 1. Visual Theme & Atmosphere

closet-room의 디자인은 **마인크래프트 인테리어를 모티브로 한 cozy 픽셀 룸**이다.
오크 plank 결무늬 바닥과 따뜻한 갈색-주황 톤의 우드, 16×16 픽셀 그리드를 베이스로 한
도트 캐릭터들이 친구의 방에 놀러온 듯한 분위기를 만든다.

**Key Characteristics:**
- Light-mode-first (게임 캔버스 영역은 본연의 픽셀 컬러를 유지)
- 주요 분위기: **친근하고 따뜻한 / 게임적인 / 약간 장난기 있는**
- 정보 밀도: 보통 — 게임 영역은 시각, 채팅 패널은 정보
- 디자인 철학: **표현력 우선** (픽셀 텍스처는 사용자 reusable identity)

**두 가지 영역의 톤 분리:**
- **게임 캔버스 (Phaser)**: 픽셀 아트, nearest-neighbor 확대, 마인크래프트 색감
- **주변 UI (Next.js + Tailwind)**: 클린한 모던 카드, 둥근 모서리, 미니멀 폰트

---

## 2. Color Palette & Roles

### Background Surfaces
| Name | Hex | Role |
|------|-----|------|
| Page Background | `#f8f9fa` | 기본 배경 |
| Surface | `#ffffff` | 카드, 패널 배경 |
| Elevated Surface | `#f1f3f5` | 호버, 활성 영역 |

### Text & Content
| Name | Hex | Role |
|------|-----|------|
| Primary Text | `#111827` | 제목, 중요 텍스트 |
| Secondary Text | `#6b7280` | 설명, 부가 정보 |
| Disabled Text | `#9ca3af` | 비활성 상태 |

### Brand & Accent (마인크래프트 우드 톤)
| Name | Hex | Role |
|------|-----|------|
| Primary | `#a76a3a` | 오크 plank base / CTA 강조 |
| Primary Dark | `#7a4a26` | plank grain / hover |
| Primary Light | `#c98c5a` | highlight |
| Wall Dark | `#4a2f1a` | 벽 음영 |
| Outline | `#1f1208` | 픽셀 outline / 강조 |
| Game BG | `#3b2a1a` | Phaser canvas 바깥 배경 |

### Status Colors
| Name | Hex | Role |
|------|-----|------|
| Success | `#10b981` | 성공, 활성 상태 |
| Warning | `#f59e0b` | 경고 |
| Error | `#ef4444` | 에러, 삭제 |
| Info | `#3b82f6` | 정보 |

### Border & Divider
| Name | Hex/RGBA | Role |
|------|----------|------|
| Border Default | `#e5e7eb` | 기본 테두리 |
| Border Strong | `#d1d5db` | 강조 테두리 |
| Divider | `#f3f4f6` | 섹션 구분선 |

---

## 3. Typography Rules

### Font Family
- **Primary**: `Pretendard Variable`, fallbacks: `-apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif`
- **Monospace**: `JetBrains Mono`, fallbacks: `ui-monospace, SF Mono, Menlo, monospace`

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| Display | 36px | 700 | 1.2 | -0.5px | 페이지 제목 |
| Heading 1 | 28px | 600 | 1.3 | -0.3px | 섹션 제목 |
| Heading 2 | 22px | 600 | 1.35 | -0.2px | 서브섹션 제목 |
| Heading 3 | 18px | 600 | 1.4 | normal | 카드 제목 |
| Body Large | 16px | 400 | 1.6 | normal | 소개, 설명 |
| Body | 14px | 400 | 1.5 | normal | 기본 텍스트 |
| Caption | 12px | 400 | 1.4 | normal | 메타데이터 |
| Label | 12px | 600 | 1.4 | 0.5px | 버튼, 레이블 |

---

## 4. Component Stylings

### Buttons

**Primary Button**
- Background: `Primary (#2563eb)` → Hover: `Primary Hover (#1d4ed8)`
- Text: `#ffffff`, Weight: 600, Size: 14px
- Padding: `10px 20px`
- Border Radius: `8px`
- Transition: `background 150ms ease`

**Secondary Button**
- Background: `transparent` → Hover: `#f3f4f6`
- Text: `Primary Text (#111827)`
- Border: `1px solid #e5e7eb`
- Border Radius: `8px`

**Destructive Button**
- Background: `Error (#ef4444)` → Hover: `#dc2626`
- Text: `#ffffff`

### Cards
- Background: `Surface (#ffffff)`
- Border: `1px solid Border Default`
- Border Radius: `12px`
- Shadow: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)`
- Padding: `24px`

### Inputs
- Background: `#ffffff`
- Border: `1px solid #d1d5db` → Focus: `2px solid Primary`
- Border Radius: `8px`
- Height: `40px`
- Padding: `0 12px`
- Text: Body (14px, 400)

### Navigation (Sidebar)
- Width: `240px`
- Background: `Surface`
- Item Padding: `8px 12px`
- Item Radius: `6px`
- Active: Background `Primary/10%`, Text `Primary`
- Hover: Background `#f3f4f6`

### Tables
- Header: Background `#f9fafb`, Text `Secondary Text`, Weight 600
- Row: Border Bottom `Divider`
- Row Hover: Background `#f9fafb`
- Cell Padding: `12px 16px`

---

## 5. Layout Principles

### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 아이콘-텍스트 간격 |
| sm | 8px | 인라인 요소 간격 |
| md | 16px | 컴포넌트 내부 패딩 |
| lg | 24px | 섹션 간 간격 |
| xl | 32px | 카드 간 간격 |
| 2xl | 48px | 대형 섹션 간격 |

### Grid
- Max Width: `1200px`
- Columns: `12`
- Gutter: `24px`
- Side Padding: `24px` (mobile: `16px`)

---

## 6. Depth & Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| 0 | none | 기본 표면 |
| 1 | `0 1px 3px rgba(0,0,0,0.04)` | 카드, 패널 |
| 2 | `0 4px 12px rgba(0,0,0,0.08)` | 드롭다운, 팝오버 |
| 3 | `0 8px 24px rgba(0,0,0,0.12)` | 모달, 다이얼로그 |
| overlay | `rgba(0,0,0,0.4)` | 배경 딤 |

---

## 7. Do's and Don'ts

### Do
- 일관된 spacing scale 사용 (4px 단위)
- 색상은 반드시 위 팔레트에서만 사용
- 인터랙티브 요소에 hover/focus 상태 필수
- 에러 메시지는 Input 바로 아래, Error 색상으로

### Don't
- 하드코딩된 색상값 금지 — 반드시 palette token 사용
- 3단계 이상 그림자 중첩 금지
- Border Radius 혼용 금지 (8px 또는 12px만)
- 16px 미만 본문 텍스트 금지

---

## 8. Responsive Behavior

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | 1 column, 사이드바 숨김 |
| Tablet | 768–1024px | 2 column, 축소된 사이드바 |
| Desktop | > 1024px | Full layout |

### Touch Targets
- 최소 크기: `44px × 44px`
- 모바일 버튼 높이: `48px`

---

## 9. Agent Prompt Guide

### Quick Color Reference
```
bg: #f8f9fa | surface: #ffffff | primary: #2563eb
text: #111827 | secondary-text: #6b7280 | border: #e5e7eb
success: #10b981 | warning: #f59e0b | error: #ef4444
```

### Ready-to-use Prompts
- "이 DESIGN.md 스타일로 관리자 대시보드 페이지를 만들어줘"
- "DESIGN.md의 카드 스타일로 데이터 테이블 컴포넌트를 만들어줘"
- "DESIGN.md의 색상 팔레트로 다크 모드 변환을 적용해줘"
