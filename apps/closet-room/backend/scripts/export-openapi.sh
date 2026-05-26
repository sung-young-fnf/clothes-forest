#!/bin/bash
#
# OpenAPI 스키마 내보내기 (NestJS Swagger)
#
# NestJS 서버가 실행 중이어야 합니다.
# Frontend에서 타입 생성에 사용됩니다.
#
# Usage:
#   cd apps/closet-room/backend
#   ./scripts/export-openapi.sh

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
OPENAPI_ENDPOINT="${BACKEND_URL}/api/docs-json"
OUTPUT_PATH="$(cd "$(dirname "$0")/.." && pwd)/openapi.json"

echo "Exporting OpenAPI schema from NestJS..."
echo "  Endpoint: ${OPENAPI_ENDPOINT}"

if ! curl -sf "${BACKEND_URL}/health" > /dev/null 2>&1; then
  echo "❌ Backend server is not running at ${BACKEND_URL}"
  echo "   Start it first: pnpm dev"
  exit 1
fi

HTTP_CODE=$(curl -sf -w "%{http_code}" -o "${OUTPUT_PATH}" "${OPENAPI_ENDPOINT}")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Failed to fetch OpenAPI schema (HTTP ${HTTP_CODE})"
  rm -f "${OUTPUT_PATH}"
  exit 1
fi

PATHS_COUNT=$(python3 -c "import json; print(len(json.load(open('${OUTPUT_PATH}')).get('paths', {})))" 2>/dev/null || echo "?")
SCHEMAS_COUNT=$(python3 -c "import json; print(len(json.load(open('${OUTPUT_PATH}')).get('components', {}).get('schemas', {})))" 2>/dev/null || echo "?")

echo "✅ OpenAPI schema exported"
echo "  Paths: ${PATHS_COUNT}"
echo "  Schemas: ${SCHEMAS_COUNT}"
echo "  Output: ${OUTPUT_PATH}"
