#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

command -v docker >/dev/null 2>&1 || {
  echo "未检测到 Docker。请先安装 Docker Desktop。" >&2
  exit 1
}
docker compose version >/dev/null

if [[ ! -f .env.solo ]]; then
  cp docs/sample_env_files/openfawu/solo.env.example .env.solo
  echo "已创建 .env.solo"
fi

python3 - <<'PY'
from pathlib import Path
import secrets

path = Path('.env.solo')
lines = path.read_text(encoding='utf-8').splitlines()
values = {}
for line in lines:
    if line and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        values[key] = value

updates = {}
if not values.get('OPENFAWU_PASSWORD'):
    updates['OPENFAWU_PASSWORD'] = secrets.token_urlsafe(18)
if not values.get('OPENFAWU_DJANGO_SECRET_KEY'):
    updates['OPENFAWU_DJANGO_SECRET_KEY'] = secrets.token_urlsafe(50)

if updates:
    output = []
    seen = set()
    for line in lines:
        if '=' in line and not line.lstrip().startswith('#'):
            key = line.split('=', 1)[0]
            if key in updates:
                output.append(f'{key}={updates[key]}')
                seen.add(key)
                continue
        output.append(line)
    for key, value in updates.items():
        if key not in seen:
            output.append(f'{key}={value}')
    path.write_text('\n'.join(output) + '\n', encoding='utf-8')
PY

set -a
# shellcheck disable=SC1091
source .env.solo
set +a

mkdir -p .envs/.solo
cp docs/sample_env_files/backend/local/.postgres .envs/.solo/.postgres
cp docs/sample_env_files/backend/local/.django .envs/.solo/.django
cp docs/sample_env_files/frontend/local/django.auth.env .envs/.solo/.frontend

upsert_env() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text(encoding='utf-8').splitlines() if path.exists() else []
out = []
replaced = False
for line in lines:
    if line.startswith(f'{key}='):
        if not replaced:
            out.append(f'{key}={value}')
            replaced = True
        continue
    out.append(line)
if not replaced:
    out.append(f'{key}={value}')
path.write_text('\n'.join(out) + '\n', encoding='utf-8')
PY
}

upsert_env .envs/.solo/.django LEGAL_SOLO_MODE True
upsert_env .envs/.solo/.django USE_AUTH0 False
upsert_env .envs/.solo/.django DJANGO_DEBUG True
upsert_env .envs/.solo/.django DJANGO_SECRET_KEY "$OPENFAWU_DJANGO_SECRET_KEY"
upsert_env .envs/.solo/.django DJANGO_SUPERUSER_USERNAME "$OPENFAWU_USERNAME"
upsert_env .envs/.solo/.django DJANGO_SUPERUSER_EMAIL "$OPENFAWU_EMAIL"
upsert_env .envs/.solo/.django DJANGO_SUPERUSER_PASSWORD "$OPENFAWU_PASSWORD"
upsert_env .envs/.solo/.django OPENAI_API_KEY "${OPENAI_API_KEY:-}"
upsert_env .envs/.solo/.django OPENAI_MODEL "${OPENAI_MODEL:-gpt-4o}"
upsert_env .envs/.solo/.django OPENAI_EMBEDDING_MODEL "${OPENAI_EMBEDDING_MODEL:-text-embedding-3-small}"
upsert_env .envs/.solo/.django OPENAI_EMBEDDING_DIMENSIONS "${OPENAI_EMBEDDING_DIMENSIONS:-384}"
upsert_env .envs/.solo/.django OPENAI_API_BASE_URL "${OPENAI_API_BASE_URL:-}"
upsert_env .envs/.solo/.django CORPUS_AUTO_BRANDING_ENABLED False

upsert_env .envs/.solo/.frontend OPEN_CONTRACTS_REACT_APP_USE_AUTH0 false
upsert_env .envs/.solo/.frontend OPEN_CONTRACTS_REACT_APP_USE_ANALYZERS true
upsert_env .envs/.solo/.frontend OPEN_CONTRACTS_REACT_APP_ALLOW_IMPORTS true
upsert_env .envs/.solo/.frontend OPEN_CONTRACTS_REACT_APP_API_ROOT_URL "http://localhost:${OPENFAWU_BACKEND_PORT:-8000}"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "警告：OPENAI_API_KEY 为空。系统会启动，但 AI 与嵌入任务暂不可用。"
fi

echo "构建 openFaWu 单人版镜像……"
docker compose --env-file .env.solo -f solo.yml build django frontend

echo "启动基础服务……"
docker compose --env-file .env.solo -f solo.yml up -d postgres redis docling-parser docxodus-parser

echo "执行数据库迁移……"
docker compose --env-file .env.solo -f solo.yml run --rm django python manage.py migrate

echo "初始化单人账户、法务知识空间和默认审查规则……"
docker compose --env-file .env.solo -f solo.yml run --rm django \
  python manage.py bootstrap_legal_solo --reset-password

echo "启动完整服务……"
docker compose --env-file .env.solo -f solo.yml up -d

cat <<EOF

openFaWu 已启动：
  网页：http://localhost:${OPENFAWU_FRONTEND_PORT:-3000}
  后端：http://localhost:${OPENFAWU_BACKEND_PORT:-8000}
  用户：${OPENFAWU_USERNAME}
  密码已保存在本机 .env.solo 中。

EOF
