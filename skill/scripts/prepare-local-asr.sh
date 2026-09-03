#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: prepare-local-asr.sh [--check|--install|--print-env]

  --check      Verify whisper-cli and the shared Whisper small model.
  --install    Install whisper-cpp with Homebrew and download the shared model.
  --print-env  Print shell exports for the installed runtime.
EOF
}

resolve_model_root() {
  if [ -n "${KNOWLEDGE_EXPLAINER_MODEL_HOME:-}" ]; then
    printf '%s\n' "$KNOWLEDGE_EXPLAINER_MODEL_HOME"
    return
  fi

  if [ "$(uname -s)" = "Darwin" ]; then
    printf '%s\n' "$HOME/Library/Application Support/AIModels"
    return
  fi

  printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/ai-models"
}

model_root="$(resolve_model_root)"
model_path="$model_root/whisper.cpp/ggml-small.bin"

check_runtime() {
  local status=0
  local whisper_binary
  whisper_binary="$(command -v whisper-cli || true)"

  if [ -z "$whisper_binary" ]; then
    printf 'Missing whisper-cli. Run this script again with --install.\n' >&2
    status=1
  else
    printf 'Whisper CLI: %s\n' "$whisper_binary"
  fi

  if [ ! -s "$model_path" ]; then
    printf 'Missing Whisper small model: %s\n' "$model_path" >&2
    status=1
  else
    printf 'Whisper model: %s\n' "$model_path"
  fi

  if [ "$status" -eq 0 ]; then
    printf 'Local ASR runtime is ready.\n'
  fi
  return "$status"
}

install_runtime() {
  if ! command -v brew >/dev/null 2>&1; then
    printf 'Homebrew is required. Install Homebrew first, then run this command again.\n' >&2
    exit 1
  fi

  if ! command -v whisper-cli >/dev/null 2>&1; then
    brew install whisper-cpp
  fi

  if [ ! -s "$model_path" ]; then
    mkdir -p "$(dirname "$model_path")"
    local temporary_path="${model_path}.download"
    trap 'rm -f "$temporary_path"' EXIT
    curl --fail --location --retry 5 --retry-all-errors \
      --output "$temporary_path" \
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
    mv "$temporary_path" "$model_path"
    trap - EXIT
  fi

  check_runtime
}

print_environment() {
  local whisper_binary
  whisper_binary="$(command -v whisper-cli || printf '%s' whisper-cli)"
  printf 'export KNOWLEDGE_EXPLAINER_WHISPER_BINARY=%q\n' "$whisper_binary"
  printf 'export KNOWLEDGE_EXPLAINER_WHISPER_MODEL=%q\n' "$model_path"
}

case "${1:---check}" in
  --check)
    check_runtime
    ;;
  --install)
    install_runtime
    ;;
  --print-env)
    print_environment
    ;;
  --help|-h)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
