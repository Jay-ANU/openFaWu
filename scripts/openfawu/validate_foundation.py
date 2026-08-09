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
    "docs/legal-solo/contract-review.md",
    "opencontractserver/legal_workspace/models.py",
    "opencontractserver/legal_workspace/migrations/0001_initial.py",
    "opencontractserver/legal_workspace/migrations/0002_contract_review_workbench.py",
    "opencontractserver/legal_workspace/services/contract_text.py",
    "opencontractserver/legal_workspace/services/review_engine.py",
    "opencontractserver/legal_workspace/tasks.py",
    "opencontractserver/legal_workspace/management/commands/bootstrap_legal_solo.py",
    "config/graphql/legal_review_api.py",
    "frontend/src/features/legal/ContractReviewDashboard.tsx",
    "frontend/src/features/legal/NewContractReviewPage.tsx",
    "frontend/src/features/legal/ContractReviewWorkspace.tsx",
    "frontend/src/features/legal/ReviewRulesPage.tsx",
    "frontend/src/features/legal/reviewApi.ts",
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
    "opencontractserver/legal_workspace/migrations/0002_contract_review_workbench.py",
    "opencontractserver/legal_workspace/services/contract_text.py",
    "opencontractserver/legal_workspace/services/review_engine.py",
    "opencontractserver/legal_workspace/tasks.py",
    "opencontractserver/legal_workspace/management/commands/bootstrap_legal_solo.py",
    "config/graphql/legal_review_api.py",
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
for route in ('path="/reviews"', 'path="/reviews/new"', 'path="/reviews/:reviewId"'):
    require(route in app_source, f"contract review route is absent: {route}")
require("ContractReviewWorkspace" in app_source, "review workbench is not routed")

menu_source = (
    ROOT / "frontend/src/assets/configurations/menus.ts"
).read_text(encoding="utf-8")
require("合同审查" in menu_source, "contract review is not the primary menu")
require("本地 Codex" not in menu_source, "Codex must not remain a primary menu item")

models_source = (
    ROOT / "opencontractserver/legal_workspace/models.py"
).read_text(encoding="utf-8")
for model_name in (
    "LegalWorkspace",
    "ReviewProfile",
    "PlaybookRule",
    "ReviewRun",
    "ContractClause",
    "ContractFinding",
):
    require(f"class {model_name}" in models_source, f"missing model {model_name}")

api_source = (ROOT / "config/graphql/legal_review_api.py").read_text(encoding="utf-8")
for field_name in (
    "createContractReview",
    "updateContractFinding",
    "completeContractReview",
):
    require(field_name in api_source, f"missing GraphQL field {field_name}")

print("openFaWu contract-review foundation validation passed")
