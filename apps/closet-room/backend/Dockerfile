# closet-room Backend — V1 (NestJS + Prisma SQLite)
# multi-stage를 단순화한 single-stage Dockerfile.
# V1 docker compose 검증용. 운영은 mono-starter 기본 multi-stage로 다시 정리.

FROM node:20-alpine
WORKDIR /app

# NODE_ENV=production은 빌드 끝나고 set (그 전에 set하면 pnpm이 devDeps인 @nestjs/cli를 skip)
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Prisma 엔진(SQLite)이 요구하는 OpenSSL 3
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Monorepo workspace 메타 (lockfile 검증용)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/closet-room/backend/package.json ./apps/closet-room/backend/
COPY apps/closet-room/frontend/package.json ./apps/closet-room/frontend/
COPY apps/closet-room/extension/package.json ./apps/closet-room/extension/

# deps 설치 (postinstall: prisma generate는 schema.prisma 없으니 skip)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile --ignore-scripts

# Backend 소스 복사
COPY apps/closet-room/backend/ ./apps/closet-room/backend/

WORKDIR /app/apps/closet-room/backend

# Prisma client 생성 + NestJS 빌드
RUN npx prisma generate
RUN pnpm build

# SQLite 파일 영속 디렉토리
RUN mkdir -p /app/data

# 빌드 끝났으니 production 모드로 전환
ENV NODE_ENV=production

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "require('http').get('http://localhost:8000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# 컨테이너 시작 시 SQLite 마이그레이션 적용 → 앱 부팅
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
