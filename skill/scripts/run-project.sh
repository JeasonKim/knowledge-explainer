#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENGINE_ROOT="${KNOWLEDGE_EXPLAINER_ENGINE_ROOT:-$SKILL_ROOT/engine}"
WORKSPACE_ROOT="${KNOWLEDGE_EXPLAINER_WORKSPACE:-$HOME/.knowledge-explainer}"
PNPM_BINARY="${KNOWLEDGE_EXPLAINER_PNPM_BINARY:-pnpm}"

if [[ $# -lt 1 ]]; then
  echo "Usage: run-project.sh <knowledge-explainer-command> [arguments...]" >&2
  exit 2
fi

if ! command -v "$PNPM_BINARY" >/dev/null 2>&1; then
  echo "Knowledge Explainer requires pnpm. Install it with: corepack enable pnpm" >&2
  exit 1
fi

if [[ ! -d "$ENGINE_ROOT" ]]; then
  echo "Knowledge Explainer engine is unavailable: $ENGINE_ROOT" >&2
  exit 1
fi

# 工作区是配置、素材与成片的唯一位置；初始化只补齐缺失文件，不覆盖用户状态。
mkdir -p \
  "$WORKSPACE_ROOT/assets/shared/subjects" \
  "$WORKSPACE_ROOT/assets/method" \
  "$WORKSPACE_ROOT/assets/imports/audio" \
  "$WORKSPACE_ROOT/assets/audio" \
  "$WORKSPACE_ROOT/episodes" \
  "$WORKSPACE_ROOT/artifacts"

copy_missing_template_files() {
  local template_root="$1"
  local workspace_target="$2"
  local source_file relative_file target_file

  [[ -d "$template_root" ]] || return 0
  while IFS= read -r -d '' source_file; do
    relative_file="${source_file#"$template_root/"}"
    target_file="$workspace_target/$relative_file"
    if [[ ! -f "$target_file" ]]; then
      mkdir -p "$(dirname "$target_file")"
      cp "$source_file" "$target_file"
    fi
  done < <(find "$template_root" -type f -print0)
}

copy_missing_template_files "$ENGINE_ROOT/workspace-template/config" "$WORKSPACE_ROOT/config"
if [[ ! -f "$WORKSPACE_ROOT/.env.example" ]]; then
  cp "$ENGINE_ROOT/workspace-template/.env.example" "$WORKSPACE_ROOT/.env.example"
fi
copy_missing_template_files "$ENGINE_ROOT/workspace-template/assets" "$WORKSPACE_ROOT/assets"

# 私密凭据只从固定工作区读取，源码包和调用目录不再承载运行状态。
if [[ -f "$WORKSPACE_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$WORKSPACE_ROOT/.env"
  set +a
fi

if [[ ! -f "$ENGINE_ROOT/node_modules/.modules.yaml" ]] \
  || [[ "$ENGINE_ROOT/package.json" -nt "$ENGINE_ROOT/node_modules/.modules.yaml" ]] \
  || [[ "$ENGINE_ROOT/pnpm-lock.yaml" -nt "$ENGINE_ROOT/node_modules/.modules.yaml" ]]; then
  "$PNPM_BINARY" --dir "$ENGINE_ROOT" install --frozen-lockfile
fi

export KNOWLEDGE_EXPLAINER_ENGINE_ROOT="$ENGINE_ROOT"
export KNOWLEDGE_EXPLAINER_WORKSPACE="$WORKSPACE_ROOT"

COMMAND="$1"
shift

cd "$WORKSPACE_ROOT"

if [[ "$COMMAND" == "template-designer" ]]; then
  exec "$PNPM_BINARY" --dir "$ENGINE_ROOT" --filter @knowledge-explainer/template-designer dev
fi

if [[ "$COMMAND" == "ingest-illustration-sheet" ]]; then
  exec "$ENGINE_ROOT/node_modules/.bin/tsx" "$ENGINE_ROOT/scripts/knowledge-explainer/ingest-illustration-sheet.ts" "$@"
fi

if [[ "$COMMAND" == "test" || "$COMMAND" == "typecheck" || "$COMMAND" == "check" ]]; then
  if [[ $# -gt 0 ]]; then
    exec "$PNPM_BINARY" --dir "$ENGINE_ROOT" run "$COMMAND" -- "$@"
  fi
  exec "$PNPM_BINARY" --dir "$ENGINE_ROOT" run "$COMMAND"
fi

exec "$ENGINE_ROOT/node_modules/.bin/tsx" "$ENGINE_ROOT/apps/cli/src/main.ts" "$COMMAND" "$@"
