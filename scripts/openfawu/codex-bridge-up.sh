#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.codex ]]; then
  "$ROOT_DIR/scripts/openfawu/codex-bridge-init.sh"
fi

set -a
# shellcheck disable=SC1091
source .env.codex
set +a

exec python3 -m openfawu_codex_bridge
