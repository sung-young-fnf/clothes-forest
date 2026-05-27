#!/usr/bin/env bash
# Closet Room — Docker Swarm autoscaler (Swarm은 native 오토스케일링이 없어 직접 구현)
#
# backend 서비스 replica들의 평균 CPU%를 주기적으로 측정해서
#   - 평균 > UP_THRESHOLD  → replica +1 (MAX까지)
#   - 평균 < DOWN_THRESHOLD → replica -1 (MIN까지)
#
# 사용: bash infra/swarm/autoscaler.sh
# 중단: Ctrl+C

set -uo pipefail

SERVICE="${SERVICE:-closet_backend}"
MIN="${MIN:-2}"
MAX="${MAX:-6}"
UP_THRESHOLD="${UP_THRESHOLD:-40}"     # 평균 CPU% 초과 시 scale up
DOWN_THRESHOLD="${DOWN_THRESHOLD:-10}" # 평균 CPU% 미만 시 scale down
INTERVAL="${INTERVAL:-15}"             # 측정 주기(초)
COOLDOWN="${COOLDOWN:-30}"             # 스케일 후 쿨다운(초)

echo "[autoscaler] service=$SERVICE min=$MIN max=$MAX up>$UP_THRESHOLD% down<$DOWN_THRESHOLD% interval=${INTERVAL}s"

last_scale_at=0

while true; do
  # backend task 컨테이너 ID 수집 (swarm service label)
  cids=$(docker ps --filter "label=com.docker.swarm.service.name=${SERVICE}" -q)
  if [ -z "$cids" ]; then
    echo "[autoscaler] $(date +%H:%M:%S) backend 컨테이너 없음 — 대기"
    sleep "$INTERVAL"
    continue
  fi

  # 한 번 호출로 모든 replica CPU% → 평균
  avg=$(docker stats --no-stream --format '{{.CPUPerc}}' $cids \
        | tr -d '%' \
        | awk '{s+=$1; n++} END{if(n>0) printf "%.1f", s/n; else print "0"}')

  current=$(docker service inspect "$SERVICE" --format '{{.Spec.Mode.Replicated.Replicas}}' 2>/dev/null)
  [ -z "$current" ] && { echo "[autoscaler] 서비스 조회 실패 (stack 배포됐나?)"; sleep "$INTERVAL"; continue; }

  now=$(date +%s)
  in_cooldown=$(( now - last_scale_at < COOLDOWN ))

  echo "[autoscaler] $(date +%H:%M:%S) replicas=$current avg_cpu=${avg}%"

  # awk로 float 비교 (exit code 0 = 참)
  up=$(awk "BEGIN{exit !($avg > $UP_THRESHOLD)}" && echo 1 || echo 0)
  down=$(awk "BEGIN{exit !($avg < $DOWN_THRESHOLD)}" && echo 1 || echo 0)

  if [ "$in_cooldown" -eq 1 ]; then
    : # 쿨다운 중 — 스케일 보류
  elif [ "$up" -eq 1 ] && [ "$current" -lt "$MAX" ]; then
    new=$((current + 1))
    echo "  ↑ scale up: $current → $new (avg ${avg}% > ${UP_THRESHOLD}%)"
    docker service scale "${SERVICE}=${new}" >/dev/null
    last_scale_at=$now
  elif [ "$down" -eq 1 ] && [ "$current" -gt "$MIN" ]; then
    new=$((current - 1))
    echo "  ↓ scale down: $current → $new (avg ${avg}% < ${DOWN_THRESHOLD}%)"
    docker service scale "${SERVICE}=${new}" >/dev/null
    last_scale_at=$now
  fi

  sleep "$INTERVAL"
done
