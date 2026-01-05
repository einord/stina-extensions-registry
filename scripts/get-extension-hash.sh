#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
NODE_SCRIPT="${SCRIPT_DIR}/get-extension-hash.js"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required to run ${NODE_SCRIPT}" >&2
  exit 1
fi

exec node "${NODE_SCRIPT}" "$@"
