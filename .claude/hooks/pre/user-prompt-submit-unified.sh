#!/bin/bash
# .claude/hooks/pre/user-prompt-submit-unified.sh
# Unified User Prompt Submit Hook (v4.0)
# 모든 UserPromptSubmit Hook을 순차적으로 실행하는 통합 스크립트
#
# 실행 순서:
# 1. project-context-check.sh (새 프로젝트 감지)
# 2. user-prompt-submit.sh (워크플로우 강제)
# 3. user-prompt-submit-git-context.sh (Git 컨텍스트)
# 4. modularization-check.sh (모듈화 규칙)

# ============================================================================
# DEBUG CONFIGURATION
# ============================================================================

DEBUG_LOG="/tmp/hook-unified-debug.log"
DEBUG_ENABLED="${HOOK_DEBUG:-false}"

log_debug() {
  if [[ "$DEBUG_ENABLED" == "true" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [unified] $*" >> "$DEBUG_LOG"
  fi
}

# ============================================================================
# SETUP
# ============================================================================

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
HOOKS_DIR="$REPO_ROOT/.claude/hooks/pre"

# 프로젝트 컨텍스트 파일 경로 (초기화 완료 여부 판단 기준)
# NOTE: SERVICE_CONTEXT.md 대신 CLAUDE.md로 체크 (토큰 최적화로 SERVICE_CONTEXT는 수동 참조)
# 양쪽 경로 모두 지원 (docs/context/ 우선)
if [[ -f "$REPO_ROOT/docs/context/SERVICE_CONTEXT.md" ]]; then
  SERVICE_CONTEXT="$REPO_ROOT/docs/context/SERVICE_CONTEXT.md"
elif [[ -f "$REPO_ROOT/docs/SERVICE_CONTEXT.md" ]]; then
  SERVICE_CONTEXT="$REPO_ROOT/docs/SERVICE_CONTEXT.md"
else
  SERVICE_CONTEXT=""  # 없음
fi

log_debug "=== UNIFIED HOOK START ==="
log_debug "REPO_ROOT: $REPO_ROOT"
log_debug "SERVICE_CONTEXT: $SERVICE_CONTEXT"

# stdin을 임시 파일로 저장 (각 Hook에서 재사용)
STDIN_TEMP=$(mktemp)
cat > "$STDIN_TEMP" 2>/dev/null

log_debug "STDIN saved to: $STDIN_TEMP (size: $(wc -c < "$STDIN_TEMP"))"

# ============================================================================
# 새 프로젝트 감지: SERVICE_CONTEXT.md 없으면 초기화 필요
# ============================================================================

if [[ -z "$SERVICE_CONTEXT" ]]; then
  log_debug "SERVICE_CONTEXT.md not found - new project detected"

  # 스킵 마커가 있으면 범용 모드 - 차단하지 않고 통과
  if [[ -f "$REPO_ROOT/.claude/.project-init-skipped" ]]; then
    log_debug "Project init skipped marker found - allowing (general mode)"
    rm -f "$STDIN_TEMP"
    exit 0
  fi

  # 사용자가 "프로젝트 초기화" 또는 "스킵"을 입력했는지 확인
  USER_INPUT=$(cat "$STDIN_TEMP" 2>/dev/null || echo "")

  # 스킵 요청이면 마커를 영구 생성하여 향후 모든 프롬프트 통과
  if echo "$USER_INPUT" | grep -qiE '초기화\s*스킵|skip\s*init|범용|general'; then
    log_debug "User requested skip - creating persistent marker"
    echo "# Skipped at $(date)" > "$REPO_ROOT/.claude/.project-init-skipped"
    rm -f "$STDIN_TEMP"
    exit 0
  fi

  if echo "$USER_INPUT" | grep -qiE '프로젝트\s*초기화|project\s*init|initialize'; then
    log_debug "User requested initialization - allowing"
    rm -f "$STDIN_TEMP"
    exit 0  # 초기화 요청은 통과
  fi

  # 그 외 모든 요청은 JSON으로 차단 (exit 0 + decision: block)
  # - decision: block = 프롬프트 처리 차단
  # - reason = 사용자에게만 표시
  rm -f "$STDIN_TEMP"
  log_debug "=== UNIFIED HOOK END (new project - BLOCKED via JSON) ==="

  cat <<'EOF'
{
  "decision": "block",
  "reason": "⛔ NEW PROJECT - 초기화 필요\n\n이 프로젝트는 아직 초기화되지 않았습니다.\n(docs/SERVICE_CONTEXT.md 없음)\n\n다음 중 하나를 입력해주세요:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. \"프로젝트 초기화\" → 프로젝트 분석 및 컨텍스트 생성\n2. \"프로젝트 초기화 스킵\" → 범용 코딩 도구로 사용\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}
EOF
  exit 0  # JSON 출력은 exit 0 필수
fi

# ============================================================================
# STEP 1: Project Context Check (기존 프로젝트용 - 스킵/초기화 요청 처리)
# ============================================================================

log_debug "Running project-context-check.sh..."

OUTPUT1=$(cat "$STDIN_TEMP" | "$HOOKS_DIR/project-context-check.sh" 2>&1)
EXIT1=$?

log_debug "project-context-check exit: $EXIT1"

if [[ -n "$OUTPUT1" ]]; then
  echo "$OUTPUT1"
fi

# ============================================================================
# STEP 2: User Prompt Submit (워크플로우 강제)
# ============================================================================

log_debug "Running user-prompt-submit.sh..."

OUTPUT2=$(cat "$STDIN_TEMP" | "$HOOKS_DIR/user-prompt-submit.sh" 2>&1)
EXIT2=$?

log_debug "user-prompt-submit exit: $EXIT2"

if [[ -n "$OUTPUT2" ]]; then
  echo "$OUTPUT2"
fi

# ============================================================================
# STEP 3: Git Context Injector
# ============================================================================

log_debug "Running user-prompt-submit-git-context.sh..."

OUTPUT3=$(cat "$STDIN_TEMP" | "$HOOKS_DIR/user-prompt-submit-git-context.sh" 2>&1)
EXIT3=$?

log_debug "git-context exit: $EXIT3"

if [[ -n "$OUTPUT3" ]]; then
  echo "$OUTPUT3"
fi

# ============================================================================
# STEP 4: Modularization Check
# ============================================================================

log_debug "Running modularization-check.sh..."

OUTPUT4=$(cat "$STDIN_TEMP" | "$HOOKS_DIR/modularization-check.sh" 2>&1)
EXIT4=$?

log_debug "modularization exit: $EXIT4"

if [[ -n "$OUTPUT4" ]]; then
  echo "$OUTPUT4"
fi

# ============================================================================
# CLEANUP
# ============================================================================

rm -f "$STDIN_TEMP"
log_debug "=== UNIFIED HOOK END ==="

exit 0
