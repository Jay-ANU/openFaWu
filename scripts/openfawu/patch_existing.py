#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    if old not in source:
        raise SystemExit(f"patch anchor missing in {relative}: {old[:80]!r}")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


replace_once(
    "config/settings/base.py",
    'if READ_DOT_ENV_FILE:\n    # OS environment variables take precedence over variables from .env\n    env.read_env(str(ROOT_DIR / ".env"))\n\n# GENERAL',
    'if READ_DOT_ENV_FILE:\n    # OS environment variables take precedence over variables from .env\n    env.read_env(str(ROOT_DIR / ".env"))\n\n# openFaWu single-user product switch. The underlying permission system stays\n# enabled; this flag controls product defaults and community-facing surfaces.\nLEGAL_SOLO_MODE = env.bool("LEGAL_SOLO_MODE", default=False)\n\n# GENERAL',
)
replace_once(
    "config/settings/base.py",
    '    "opencontractserver.research",\n]',
    '    "opencontractserver.research",\n    "opencontractserver.legal_workspace",\n]',
)

replace_once(
    "frontend/src/App.tsx",
    'import { DiscoveryLanding } from "./views/DiscoveryLanding";',
    'import { LegalDashboard } from "./features/legal";',
)
replace_once(
    "frontend/src/App.tsx",
    '          <Route\n            path="/"\n            element={isLoading ? <div /> : <DiscoveryLanding />}\n          />',
    '          <Route\n            path="/"\n            element={isLoading ? <div /> : <LegalDashboard />}\n          />\n          <Route path="/legal" element={<LegalDashboard />} />',
)

nav_path = ROOT / "frontend/src/components/layout/NavMenu.tsx"
nav = nav_path.read_text(encoding="utf-8")
nav = nav.replace("[OpenContracts]", "[openFaWu]")
nav = nav.replace('ariaLabel="OpenContracts"', 'ariaLabel="openFaWu"')
nav_path.write_text(nav, encoding="utf-8")

readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
marker = "<!-- OPENFAWU-DERIVATIVE -->"
if marker not in readme:
    prefix = """<!-- OPENFAWU-DERIVATIVE -->
# openFaWu · 单人私有法务 Agent

本仓库基于 OpenContracts 构建。openFaWu 的启动方式、当前实现范围和安全边界见 [OPENFAWU.md](OPENFAWU.md)。下方保留完整上游说明与归属信息。

---

"""
    readme_path.write_text(prefix + readme, encoding="utf-8")

gitignore_path = ROOT / ".gitignore"
gitignore = gitignore_path.read_text(encoding="utf-8")
for entry in (".env.solo", ".envs/.solo/", "backups/openfawu/"):
    if entry not in gitignore.splitlines():
        gitignore += f"\n{entry}"
gitignore_path.write_text(gitignore.rstrip() + "\n", encoding="utf-8")

print("openFaWu existing files patched")
