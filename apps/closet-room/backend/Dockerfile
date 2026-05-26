# closet-room Backend (NestJS + Prisma)
# Production Dockerfile (Monorepo multi-stage)

# ─── Deps ───
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Monorepo workspace
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/closet-room/backend/package.json ./apps/closet-room/backend/

# pnpm store cache로 재빌드 시 다운로드 최소화
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Builder ───
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY --from=deps /app ./
COPY apps/closet-room/backend/ ./apps/closet-room/backend/
COPY packages/ ./packages/

WORKDIR /app/apps/closet-room/backend

# Prisma generate (custom output → src/generated/prisma-client)
RUN if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi

# NestJS build
RUN pnpm build

# Prisma engine binary (tsc는 .node 미포함)
RUN mkdir -p dist/src/generated/prisma-client/ && \
    cp src/generated/prisma-client/libquery_engine* dist/src/generated/prisma-client/ 2>/dev/null || true

# pnpm deploy: symlink 해소된 독립 node_modules
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm deploy --filter=apps/closet-room/backend /app/deploy 2>/dev/null || \
    cp -r /app/apps/closet-room/backend/node_modules /app/deploy/node_modules

# .prisma/client 런타임 복사 (custom output 경로 동기화)
RUN mkdir -p /app/deploy/node_modules/.prisma/client && \
    cp -r /app/apps/closet-room/backend/src/generated/prisma-client/* \
          /app/deploy/node_modules/.prisma/client/ 2>/dev/null || true

# ─── Runner ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Prisma 엔진(SQLite 환경)이 필요로 하는 OpenSSL
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/closet-room/backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/closet-room/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/closet-room/backend/prisma ./prisma

# SQLite 파일 저장용 디렉토리
RUN mkdir -p /app/data && chown nestjs:nodejs /app/data

USER nestjs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

# 컨테이너 시작 시 SQLite 마이그레이션 적용 → 앱 부팅
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
