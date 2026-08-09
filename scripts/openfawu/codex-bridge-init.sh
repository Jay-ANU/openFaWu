#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

QUIET=false
if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=true
fi

if [[ ! -f .env.codex ]]; then
  cp docs/sample_env_files/openfawu/codex-bridge.env.example .env.codex
fi

python3 - <<'PY'
from pathlib import Path
import os
import secrets

path = Path('.env.codex')
lines = path.read_text(encoding='utf-8').splitlines()
values: dict[str, str] = {}
for line in lines:
    if line and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        values[key] = value

updates: dict[str, str] = {}
if not values.get('OPENFAWU_CODEX_BRIDGE_TOKEN'):
    updates['OPENFAWU_CODEX_BRIDGE_TOKEN'] = secrets.token_urlsafe(32)
if not values.get('OPENFAWU_CODEX_ALLOWED_ROOTS'):
    updates['OPENFAWU_CODEX_ALLOWED_ROOTS'] = str(
        (Path.home() / '.openfawu' / 'workspaces').resolve()
    )

frontend_port = '3000'
solo = Path('.env.solo')
if solo.exists():
    for line in solo.read_text(encoding='utf-8').splitlines():
        if line.startswith('OPENFAWU_FRONTEND_PORT='):
            frontend_port = line.split('=', 1)[1].strip() or frontend_port
updates['OPENFAWU_CODEX_ALLOWED_ORIGINS'] = (
    f'http://localhost:{frontend_port},http://127.0.0.1:{frontend_port}'
)

out: list[str] = []
seen: set[str] = set()
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        key = line.split('=', 1)[0]
        if key in updates:
            out.append(f'{key}={updates[key]}')
            seen.add(key)
            continue
    out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f'{key}={value}')
path.write_text('\n'.join(out) + '\n', encoding='utf-8')

workspace = Path(updates.get('OPENFAWU_CODEX_ALLOWED_ROOTS') or values.get('OPENFAWU_CODEX_ALLOWED_ROOTS', '')).expanduser()
workspace.mkdir(parents=True, exist_ok=True)
PY

chmod 600 .env.codex 2>/dev/null || true

set -a
# shellcheck disable=SC1091
source .env.codex
set +a

if [[ "$QUIET" != true ]]; then
  cat <<EOF2
本地 Codex 桥接器配置已生成：
  配置：$ROOT_DIR/.env.codex
  工作区：$OPENFAWU_CODEX_ALLOWED_ROOTS
  地址：http://${OPENFAWU_CODEX_BRIDGE_HOST:-127.0.0.1}:${OPENFAWU_CODEX_BRIDGE_PORT:-8765}

网页首次连接时，需要把 .env.codex 中的 OPENFAWU_CODEX_BRIDGE_TOKEN
粘贴到“本地 Codex”页面。Token 只保存在本机浏览器 localStorage 中。
EOF2
fi

if ! command -v "${OPENFAWU_CODEX_BIN:-codex}" >/dev/null 2>&1; then
  if [[ "$QUIET" != true ]]; then
    cat <<'EOF2'

尚未检测到 Codex CLI。安装后执行 `codex login`，或在网页中使用设备码登录：
  npm install -g @openai/codex
  # 或 macOS: brew install --cask codex
EOF2
  fi
fi
