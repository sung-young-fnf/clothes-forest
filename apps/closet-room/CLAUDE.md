# closet-room

## Tech Stack
| Layer | Tech |
|-------|------|
| Backend | TypeScript NestJS + Prisma |
| Frontend | Next.js 16 React 19 TypeScript |
| DB Schema | `closet_room.*` (PostgreSQL, DBUSER 정책) |
| Auth | JWT (자체 인증) |

## DB 작업 시 필수
- public 스키마 금지 → `closet_room` 스키마만 사용
- 앱 런타임: `closet_room_svc` 계정 (DML 전용)
- 마이그레이션: `closet_room_prisma_ops` 계정

## BFF 패턴 (필수)
```
Browser → Next.js API Route → nestjs Backend
```
