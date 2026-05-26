# closet-room Frontend (Next.js 16)
# Production Dockerfile (Monorepo multi-stage)

# ─── Deps ───
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Monorepo workspace
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/closet-room/frontend/package.json ./apps/closet-room/frontend/

# pnpm store cache
RUN --mount=type=cache,id=pnpm-fe,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Builder ───
FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* 변수는 빌드 시점에 번들에 인라인됨
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY --from=deps /app ./
COPY apps/closet-room/frontend/ ./apps/closet-room/frontend/
COPY packages/ ./packages/

WORKDIR /app/apps/closet-room/frontend

# OOM 방지: 힙 확장
RUN NODE_OPTIONS="--max-old-space-size=8192" pnpm build

# ─── Runner ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone (모노레포 디렉토리 구조 유지)
COPY --from=builder --chown=nextjs:nodejs /app/apps/closet-room/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/closet-room/frontend/.next/static ./apps/closet-room/frontend/.next/static

# public (standalone 미포함)
COPY --from=builder --chown=nextjs:nodejs /app/apps/closet-room/frontend/public ./apps/closet-room/frontend/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/closet-room/frontend/server.js"]
