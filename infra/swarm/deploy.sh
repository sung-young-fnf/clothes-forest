#!/usr/bin/env bash
# Closet Room — Swarm stack 배포 헬퍼
# 1) 이미지 빌드 (swarm은 build 안 함) 2) swarm init 3) 스키마 push 4) stack deploy
#
# 사용: bash infra/swarm/deploy.sh
# 프로젝트 루트에서 실행 (clothes-forest/)

set -euo pipefail

STACK="closet"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== 1. 이미지 빌드 =="
docker build -t closet-room-backend:latest -f apps/closet-room/backend/Dockerfile .
docker build -t closet-room-frontend:latest \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 \
  -f apps/closet-room/frontend/Dockerfile .

echo "== 2. Swarm init (이미 활성이면 skip) =="
docker swarm init 2>/dev/null || echo "  (이미 swarm 활성)"

echo "== 3. .env를 shell로 로드 (stack deploy는 .env 자동 안 읽음) =="
if [ -f .env ]; then
  set -a; . ./.env; set +a
  echo "  .env 로드됨"
else
  echo "  ⚠️ .env 없음 — 기본값 사용"
fi

echo "== 4. Stack deploy =="
docker stack deploy -c docker-stack.yml "$STACK"

echo ""
echo "✅ 배포 완료. 상태 확인:"
echo "   docker stack services $STACK"
echo "   docker service logs ${STACK}_backend -f"
echo ""
echo "오토스케일러 실행:"
echo "   bash infra/swarm/autoscaler.sh"
echo ""
echo "내리기:"
echo "   docker stack rm $STACK"
