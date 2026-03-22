#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

usage() {
  echo "Usage: $0 [dev|preview|build]" >&2
  echo "  dev     — Vite dev server (default)" >&2
  echo "  preview — production build preview (run build first if needed)" >&2
  echo "  build   — tsc + vite build only" >&2
}

cmd="${1:-dev}"
case "$cmd" in
  dev)    npm run dev ;;
  preview) npm run preview ;;
  build)  npm run build ;;
  -h|--help) usage; exit 0 ;;
  *) usage; exit 1 ;;
esac
