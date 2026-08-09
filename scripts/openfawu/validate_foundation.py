#!/usr/bin/env python3
from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED = (
    "solo.yml",
    "openfawu.mk",
    "OPENFAWU.md",
    ".openfawu/upstream.json",
    "opencontractserver/legal_workspace/models.py",
    "opencontractserver/legal_workspace/migrations/0001_initial.py",
    "opencontractserver/legal_workspace/management/commands/bootstrap_legal_solo.py",
    "frontend/src/features/legal/LegalDashboard.tsx",
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"foundation validation failed: {message}")


for relative in REQUIRED:
    require((ROOT / relative).is_file(), f"missing {relative}")

for relative in (
    "opencontractserver/legal_workspace/apps.py",
    "opencontractserver/legal_workspace/enums.py",
    "opencontractserver/legal_workspace/models.py",
    "opencontractserver/legal_workspace/admin.py",
    "opencontractserver/legal_workspace/migrations/0001_initial.py",
    "opencontractserver/legal_workspace/management/commands/bootstrap_legal_solo.py",
):
    source = (ROOT / relative).read_text(encoding="utf-8")
    ast.parse(source, filename=relative)

settings_source = (ROOT / "config/settings/base.py").read_text(encoding="utf-8")
require("LEGAL_SOLO_MODE" in settings_source, "LEGAL_SOLO_MODE setting is absent")
require(
    '"opencontractserver.legal_workspace"' in settings_source,
    "legal_workspace is not installed",
)

app_source = (ROOT / "frontend/src/App.tsx").read_text(encoding="utf-8")
require("LegalDashboard" in app_source, "legal dashboard is not routed")

menu_source = (
    ROOT / "frontend/src/assets/configurations/menus.ts"
).read_text(encoding="utf-8")
require("工作台" in menu_source and "Leaderboard" not in menu_source, "legal menu not active")

models_source = (
    ROOT / "opencontractserver/legal_workspace/models.py"
).read_text(encoding="utf-8")
for model_name in (
    "LegalWorkspace",
    "ReviewProfile",
    "PlaybookRule",
    "ReviewRun",
    "ContractFinding",
    "ResearchRun",
):
    require(f"class {model_name}" in models_source, f"missing model {model_name}")

print("openFaWu foundation validation passed")
