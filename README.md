# Closet Room

> 픽셀 방에 모인 사람들과 **같이 쇼핑하는 공간**.
> 익명 닉네임 + 동물 캐릭터로 입장해 채팅하고, 누군가 "검색"을 누르면
> Chrome Extension이 그 화면을 방으로 broadcast해서 **Claude가 모두에게 조언**해줍니다.

> 🧪 Docker 기초 실습 과제 개인 프로젝트 — fnf-mono-starter 베이스.

---

## 핵심 기능 (V1)

| 영역 | 내용 |
|---|---|
| 🚪 입장 | 닉네임 + 동물 6종 카드 → 익명 JWT (httpOnly 쿠키) |
| 🏠 픽셀 방 | Phaser.js + 마인크래프트 오크 plank 룩 (바닥/벽/가구/동물 전신 스프라이트) |
| 👥 멀티플레이 | Socket.io Gateway, 위치·채팅 실시간 동기화 |
| 💬 공용 채팅 | rate limit (초당 1·분당 30) + 머리 위 말풍선 3초 페이드 |
| 🤖 Claude `@claude` 멘션 | AWS Bedrock Sonnet 4.5, persona 가드레일 |
| 🛒 Chrome Extension | 무신사·29CM·쿠팡·지그재그 페이지를 방으로 자동 공유 (페이지 카드 UI) |
| 🔐 SSO 로그인 페이지 | Azure AD / NextAuth v5 코드 준비 (V1.5에서 어드민용 활성화) |
| ⚙️ 모더레이션 | 닉네임 비속어 필터, 5분 자리비움 자동 퇴장, 민감 URL(결제/로그인) 차단 |

<img width="1256" height="630" alt="스크린샷 2026-05-26 165908" src="https://github.com/user-attachments/assets/a5b66d3f-c02a-41bb-983c-b810bc741f75" />

---

## 기술 스택

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind + **Phaser.js** |
| Backend | NestJS 10 + Prisma + **Socket.io** + Valkey adapter |
| DB | **SQLite** (V1, 파일 1개) / Postgres + pgvector (V2 예정) |
| Auth | 자체 익명 JWT (메인) + NextAuth v5 Azure AD (`/login`, V1.5 활성화) |
| AI | Anthropic SDK + **AWS Bedrock** (Sonnet 4.5) |
| Extension | Manifest V3 + TypeScript + Vite |
| Infra | Docker Compose (V1) / K8s + Helm + ArgoCD (V2, mono-starter 준비됨) |

---

## Quick Start — Docker Compose (권장)

```powershell
# 1) 환경변수 채우기 (한 번)
cp .env.docker.example .env
# .env 열어서 JWT_SECRET / AUTH_SECRET / AWS_BEARER_TOKEN_BEDROCK 등 입력

# 2) 전체 기동
docker compose up --build

# 3) 종료
docker compose down            # 컨테이너만 제거 (DB 유지)
docker compose down -v         # 볼륨까지 제거 (Valkey 초기화)
```

접속:
- 메인 (익명 입장): http://localhost:3000
- SSO 페이지: http://localhost:3000/login
- 백엔드 헬스: http://localhost:8000/api/health
- Swagger: http://localhost:8000/api/docs

---

## Quick Start — Local Dev (Hot Reload)

서로 다른 터미널 2개:

```powershell
# Backend (port 8000)
cd apps/closet-room/backend
pnpm dev

# Frontend (port 3000)
cd apps/closet-room/frontend
pnpm dev
```

Chrome Extension (선택):

```powershell
cd apps/closet-room/extension
pnpm build
# → chrome://extensions → 개발자 모드 → 압축해제된 확장 프로그램 로드 → dist/ 선택
```

---

## 프로젝트 구조

```
clothes-forest/
├── apps/closet-room/
│   ├── backend/             # NestJS + Prisma(SQLite) + Socket.io
│   ├── frontend/            # Next.js 16 + Phaser.js + ChatPanel
│   └── extension/           # Chrome Extension (Manifest V3, Vite)
├── docker-compose.yml       # V1 — FE + BE + Valkey
├── charts/closet-room/      # Helm chart (V2 K8s 배포용, 미사용)
├── argocd/                  # ArgoCD App CR (V2 GitOps, 미사용)
├── clothesPlan.md           # 기획서 (V1/V2 로드맵)
└── TASKS.md                 # 진행 체크리스트
```

---

## 환경변수 (.env)

```env
# 서버 시크릿 (랜덤 32바이트)
JWT_SECRET=...
AUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Azure AD SSO (V1.5 — 지금은 placeholder)
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...

# Claude via AWS Bedrock (비우면 @claude 멘션은 안내 메시지로 fallback)
AWS_REGION=us-west-2
AWS_BEARER_TOKEN_BEDROCK=
SONNET_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

랜덤 시크릿 생성:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 라이선스 / 출처

- 기반: **fnf-mono-starter** (F&F 내부 모노레포 템플릿)
- 픽셀 텍스처: 자체 코드 생성 (마인크래프트 텍스처 직접 사용 X)
- 사용 라이브러리: Next.js, NestJS, Phaser.js, Prisma, NextAuth, Socket.io, Anthropic SDK
