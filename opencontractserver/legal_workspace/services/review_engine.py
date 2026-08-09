from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from django.db import transaction

from opencontractserver.documents.models import DocumentProcessingStatus
from opencontractserver.legal_workspace.enums import (
    EvidenceType,
    FindingReviewStatus,
    ReviewRunStatus,
    VerificationStatus,
)
from opencontractserver.legal_workspace.models import (
    ContractClause,
    ContractFinding,
    ReviewRun,
)
from opencontractserver.legal_workspace.services.contract_text import (
    RuleSpec,
    deduplicate_findings,
    evaluate_generic_checks,
    evaluate_playbook_rules,
    normalize_contract_text,
    parse_contract_clauses,
)

logger = logging.getLogger(__name__)

MAX_CONTRACT_TEXT_BYTES = 12 * 1024 * 1024
ENGINE_VERSION = "deterministic-v1"


class DocumentTextNotReady(RuntimeError):
    """Raised while OpenContracts is still parsing the uploaded contract."""


class DocumentProcessingFailed(RuntimeError):
    """Raised when the source document parser failed permanently."""


def read_document_text(review_run: ReviewRun) -> str:
    document = review_run.document
    if document.processing_status == DocumentProcessingStatus.FAILED:
        message = document.processing_error or "合同文档解析失败。"
        raise DocumentProcessingFailed(message)

    if not document.txt_extract_file:
        raise DocumentTextNotReady("合同文本层尚未生成。")

    try:
        with document.txt_extract_file.open("rb") as handle:
            payload = handle.read(MAX_CONTRACT_TEXT_BYTES + 1)
    except FileNotFoundError as exc:
        raise DocumentTextNotReady("合同文本层文件尚未可用。") from exc

    if len(payload) > MAX_CONTRACT_TEXT_BYTES:
        raise ValueError("合同文本超过 12MB，暂不支持自动审查。")

    text = normalize_contract_text(payload.decode("utf-8", errors="replace"))
    if not text.strip():
        raise DocumentTextNotReady("合同文本层为空。")
    return text


def _rule_specs(review_run: ReviewRun) -> list[RuleSpec]:
    rules = review_run.review_profile.rules.filter(enabled=True).order_by(
        "sort_order", "id"
    )
    return [
        RuleSpec(
            rule_id=rule.id,
            category=rule.category,
            title=rule.title,
            severity=rule.severity,
            description=rule.description,
            required_terms=tuple(str(v) for v in (rule.required_terms or []) if v),
            prohibited_terms=tuple(
                str(v) for v in (rule.prohibited_terms or []) if v
            ),
            required_terms_mode=rule.required_terms_mode,
            standard_position=rule.standard_position,
            fallback_position=rule.fallback_position,
            suggested_language=rule.suggested_language,
            business_question=rule.business_question,
            applicability=rule.applicability or {},
            blocking=rule.blocking,
        )
        for rule in rules
    ]


def _set_status(review_run: ReviewRun, status: str) -> None:
    review_run.transition_to(status)
    review_run.save(
        update_fields=[
            "status",
            "current_stage",
            "started_at",
            "completed_at",
            "updated_at",
        ]
    )


def mark_waiting_for_document(review_run: ReviewRun, message: str) -> None:
    if review_run.status in {
        ReviewRunStatus.FAILED,
        ReviewRunStatus.CANCELLED,
        ReviewRunStatus.COMPLETED,
    }:
        return
    if review_run.status == ReviewRunStatus.PENDING:
        review_run.transition_to(ReviewRunStatus.WAITING_FOR_DOCUMENT)
    review_run.current_stage = ReviewRunStatus.WAITING_FOR_DOCUMENT
    review_run.error_message = message
    review_run.save(
        update_fields=["status", "current_stage", "error_message", "updated_at"]
    )


def mark_review_failed(review_run: ReviewRun, message: str) -> None:
    if review_run.status not in {
        ReviewRunStatus.FAILED,
        ReviewRunStatus.CANCELLED,
        ReviewRunStatus.COMPLETED,
    }:
        review_run.transition_to(ReviewRunStatus.FAILED)
    review_run.error_message = message[:8000]
    review_run.save(
        update_fields=[
            "status",
            "current_stage",
            "completed_at",
            "error_message",
            "updated_at",
        ]
    )


def run_contract_review(review_run_id: int) -> ReviewRun:
    review_run = (
        ReviewRun.objects
        .select_related("document", "review_profile", "workspace__corpus")
        .get(pk=review_run_id)
    )

    if review_run.status in {
        ReviewRunStatus.PARSING,
        ReviewRunStatus.EXTRACTING,
        ReviewRunStatus.MATCHING_RULES,
        ReviewRunStatus.ANALYZING,
        ReviewRunStatus.VERIFYING,
        ReviewRunStatus.READY_FOR_REVIEW,
        ReviewRunStatus.CANCELLED,
        ReviewRunStatus.COMPLETED,
    }:
        # A duplicate task must not overwrite an active or already reviewed run.
        return review_run

    text = read_document_text(review_run)
    review_run.error_message = ""
    if review_run.status in {
        ReviewRunStatus.FAILED,
        ReviewRunStatus.CANCELLED,
    }:
        review_run.status = ReviewRunStatus.PENDING
        review_run.current_stage = ReviewRunStatus.PENDING
        review_run.completed_at = None
        review_run.save(
            update_fields=[
                "status",
                "current_stage",
                "completed_at",
                "updated_at",
            ]
        )

    if review_run.status in {
        ReviewRunStatus.PENDING,
        ReviewRunStatus.WAITING_FOR_DOCUMENT,
    }:
        _set_status(review_run, ReviewRunStatus.PARSING)
    else:
        return review_run

    parsed_clauses = parse_contract_clauses(text)
    with transaction.atomic():
        review_run.clauses.all().delete()
        review_run.findings.all().delete()
        ContractClause.objects.bulk_create(
            [
                ContractClause(
                    review_run=review_run,
                    clause_type=clause.clause_type,
                    heading=clause.heading,
                    text=clause.text,
                    source_start=clause.source_start,
                    source_end=clause.source_end,
                    sort_order=clause.sort_order,
                    confidence=clause.confidence,
                )
                for clause in parsed_clauses
            ]
        )
    clause_models = list(review_run.clauses.order_by("sort_order", "id"))

    _set_status(review_run, ReviewRunStatus.EXTRACTING)
    context: dict[str, Any] = dict(review_run.input_context or {})
    review_run.extracted_contract_data = {
        "engine_version": ENGINE_VERSION,
        "character_count": len(text),
        "clause_count": len(parsed_clauses),
        "contract_type": context.get("contract_type"),
        "party_position": context.get("party_position"),
        "jurisdiction": context.get("jurisdiction"),
        "document_processing_status": review_run.document.processing_status,
    }
    review_run.save(update_fields=["extracted_contract_data", "updated_at"])

    _set_status(review_run, ReviewRunStatus.MATCHING_RULES)
    rule_specs = _rule_specs(review_run)
    drafts = evaluate_playbook_rules(text, parsed_clauses, rule_specs, context)

    _set_status(review_run, ReviewRunStatus.ANALYZING)
    drafts.extend(evaluate_generic_checks(text, parsed_clauses, context))
    drafts = deduplicate_findings(drafts)

    findings: list[ContractFinding] = []
    for sort_order, draft in enumerate(drafts):
        clause = (
            clause_models[draft.clause_index]
            if draft.clause_index is not None
            and 0 <= draft.clause_index < len(clause_models)
            else None
        )
        findings.append(
            ContractFinding(
                review_run=review_run,
                clause=clause,
                clause_title=clause.heading if clause else "合同全文",
                category=draft.category,
                title=draft.title,
                risk_type=draft.risk_type,
                severity=draft.severity,
                evidence_type=EvidenceType.CONTRACT_TEXT,
                risk_summary=draft.risk_summary,
                source_quote=draft.source_quote,
                source_start=draft.source_start,
                source_end=draft.source_end,
                playbook_rule_id=draft.rule_id,
                business_impact=draft.business_impact,
                recommended_action=draft.recommended_action,
                suggested_replacement=draft.suggested_replacement,
                fallback_position=draft.fallback_position,
                required_confirmation=draft.required_confirmation,
                rule_snapshot=dict(draft.rule_snapshot or {}),
                confidence=draft.confidence,
                verification_status=VerificationStatus.NEEDS_CONFIRMATION,
                review_status=FindingReviewStatus.PENDING,
                sort_order=sort_order,
            )
        )
    with transaction.atomic():
        ContractFinding.objects.bulk_create(findings)

    _set_status(review_run, ReviewRunStatus.VERIFYING)
    severity_counts: dict[str, int] = {}
    for draft in drafts:
        severity_counts[draft.severity] = severity_counts.get(draft.severity, 0) + 1
    review_run.extracted_contract_data = {
        **review_run.extracted_contract_data,
        "finding_count": len(drafts),
        "severity_counts": severity_counts,
        "rules_evaluated": len(rule_specs),
    }
    review_run.summary = (
        f"已识别 {len(parsed_clauses)} 个条款片段，执行 {len(rule_specs)} 条 Playbook 规则，"
        f"生成 {len(drafts)} 项待人工复核风险。"
    )
    review_run.model_name = "deterministic"
    review_run.prompt_version = ENGINE_VERSION
    review_run.save(
        update_fields=[
            "extracted_contract_data",
            "summary",
            "model_name",
            "prompt_version",
            "updated_at",
        ]
    )
    _set_status(review_run, ReviewRunStatus.READY_FOR_REVIEW)
    logger.info(
        "Contract review %s ready: %s clauses, %s findings",
        review_run.id,
        len(parsed_clauses),
        len(drafts),
    )
    return review_run
