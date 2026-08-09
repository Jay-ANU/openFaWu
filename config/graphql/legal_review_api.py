from __future__ import annotations

import datetime
from typing import Annotated, Any

import strawberry
from django.db import transaction
from django.db.models import Count, Q
from graphql import GraphQLError

from config.graphql.core.scalars import GenericScalar
from opencontractserver.corpuses.models import Corpus
from opencontractserver.corpuses.services.corpus_service import CorpusService
from opencontractserver.documents.models import Document
from opencontractserver.legal_workspace.enums import (
    FindingReviewStatus,
    MatterType,
    PartyPosition,
    ReviewRunStatus,
    WorkspaceType,
)
from opencontractserver.legal_workspace.models import (
    ContractClause,
    ContractFinding,
    LegalWorkspace,
    PlaybookRule,
    ReviewProfile,
    ReviewRun,
)
from opencontractserver.legal_workspace.tasks import run_contract_review_task


STATUS_PROGRESS = {
    ReviewRunStatus.PENDING: 5,
    ReviewRunStatus.WAITING_FOR_DOCUMENT: 12,
    ReviewRunStatus.PARSING: 24,
    ReviewRunStatus.EXTRACTING: 40,
    ReviewRunStatus.MATCHING_RULES: 56,
    ReviewRunStatus.ANALYZING: 72,
    ReviewRunStatus.VERIFYING: 88,
    ReviewRunStatus.READY_FOR_REVIEW: 100,
    ReviewRunStatus.COMPLETED: 100,
    ReviewRunStatus.FAILED: 100,
    ReviewRunStatus.CANCELLED: 100,
}


def _require_user(info: strawberry.Info):
    user = getattr(info.context, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        raise GraphQLError("Authentication required")
    return user


def _file_url(field: Any) -> str | None:
    if not field:
        return None
    try:
        return field.url
    except Exception:
        return None


@strawberry.type(name="LegalPlaybookRuleType")
class LegalPlaybookRuleType:
    id: strawberry.ID
    category: str
    title: str
    description: str
    severity: str
    required_terms: list[str]
    prohibited_terms: list[str]
    required_terms_mode: str
    applicability: GenericScalar
    standard_position: str
    fallback_position: str
    suggested_language: str
    legal_basis_description: str
    business_question: str
    blocking: bool
    sort_order: int

    @classmethod
    def from_model(cls, rule: PlaybookRule) -> "LegalPlaybookRuleType":
        return cls(
            id=strawberry.ID(str(rule.id)),
            category=rule.category,
            title=rule.title,
            description=rule.description,
            severity=rule.severity,
            required_terms=[str(v) for v in (rule.required_terms or [])],
            prohibited_terms=[str(v) for v in (rule.prohibited_terms or [])],
            required_terms_mode=rule.required_terms_mode,
            applicability=rule.applicability or {},
            standard_position=rule.standard_position,
            fallback_position=rule.fallback_position,
            suggested_language=rule.suggested_language,
            legal_basis_description=rule.legal_basis_description,
            business_question=rule.business_question,
            blocking=rule.blocking,
            sort_order=rule.sort_order,
        )


@strawberry.type(name="LegalReviewProfileType")
class LegalReviewProfileType:
    id: strawberry.ID
    name: str
    contract_type: str = strawberry.field(name="contractType")
    party_position: str = strawberry.field(name="partyPosition")
    jurisdiction: str
    description: str
    version: int
    enabled: bool
    rule_count: int = strawberry.field(name="ruleCount")
    rules: list[LegalPlaybookRuleType]

    @classmethod
    def from_model(cls, profile: ReviewProfile) -> "LegalReviewProfileType":
        prefetched = list(profile.rules.all())
        return cls(
            id=strawberry.ID(str(profile.id)),
            name=profile.name,
            contract_type=profile.contract_type,
            party_position=profile.party_position,
            jurisdiction=profile.jurisdiction,
            description=profile.description,
            version=profile.version,
            enabled=profile.enabled,
            rule_count=len(prefetched),
            rules=[LegalPlaybookRuleType.from_model(rule) for rule in prefetched],
        )


@strawberry.type(name="LegalContractClauseType")
class LegalContractClauseType:
    id: strawberry.ID
    clause_type: str = strawberry.field(name="clauseType")
    heading: str
    text: str
    source_start: int = strawberry.field(name="sourceStart")
    source_end: int = strawberry.field(name="sourceEnd")
    page_number: int | None = strawberry.field(name="pageNumber")
    sort_order: int = strawberry.field(name="sortOrder")
    confidence: float | None
    risk_count: int = strawberry.field(name="riskCount")

    @classmethod
    def from_model(cls, clause: ContractClause) -> "LegalContractClauseType":
        annotated_count = getattr(clause, "risk_count", None)
        return cls(
            id=strawberry.ID(str(clause.id)),
            clause_type=clause.clause_type,
            heading=clause.heading,
            text=clause.text,
            source_start=clause.source_start,
            source_end=clause.source_end,
            page_number=clause.page_number,
            sort_order=clause.sort_order,
            confidence=clause.confidence,
            risk_count=(
                int(annotated_count)
                if annotated_count is not None
                else clause.findings.count()
            ),
        )


@strawberry.type(name="LegalContractFindingType")
class LegalContractFindingType:
    id: strawberry.ID
    category: str
    title: str
    risk_type: str = strawberry.field(name="riskType")
    clause_id: strawberry.ID | None = strawberry.field(name="clauseId")
    clause_title: str = strawberry.field(name="clauseTitle")
    severity: str
    risk_summary: str = strawberry.field(name="riskSummary")
    source_quote: str = strawberry.field(name="sourceQuote")
    source_start: int | None = strawberry.field(name="sourceStart")
    source_end: int | None = strawberry.field(name="sourceEnd")
    page_number: int | None = strawberry.field(name="pageNumber")
    playbook_rule_id: strawberry.ID | None = strawberry.field(name="playbookRuleId")
    business_impact: str = strawberry.field(name="businessImpact")
    recommended_action: str = strawberry.field(name="recommendedAction")
    suggested_replacement: str = strawberry.field(name="suggestedReplacement")
    fallback_position: str = strawberry.field(name="fallbackPosition")
    required_confirmation: str = strawberry.field(name="requiredConfirmation")
    confidence: float | None
    verification_status: str = strawberry.field(name="verificationStatus")
    review_status: str = strawberry.field(name="reviewStatus")
    reviewer_text: str = strawberry.field(name="reviewerText")
    sort_order: int = strawberry.field(name="sortOrder")
    blocking: bool

    @classmethod
    def from_model(cls, finding: ContractFinding) -> "LegalContractFindingType":
        blocking = bool(
            finding.playbook_rule.blocking if finding.playbook_rule_id else False
        )
        return cls(
            id=strawberry.ID(str(finding.id)),
            category=finding.category,
            title=finding.title,
            risk_type=finding.risk_type,
            clause_id=(
                strawberry.ID(str(finding.clause_id)) if finding.clause_id else None
            ),
            clause_title=finding.clause_title,
            severity=finding.severity,
            risk_summary=finding.risk_summary,
            source_quote=finding.source_quote,
            source_start=finding.source_start,
            source_end=finding.source_end,
            page_number=finding.page_number,
            playbook_rule_id=(
                strawberry.ID(str(finding.playbook_rule_id))
                if finding.playbook_rule_id
                else None
            ),
            business_impact=finding.business_impact,
            recommended_action=finding.recommended_action,
            suggested_replacement=finding.suggested_replacement,
            fallback_position=finding.fallback_position,
            required_confirmation=finding.required_confirmation,
            confidence=finding.confidence,
            verification_status=finding.verification_status,
            review_status=finding.review_status,
            reviewer_text=finding.reviewer_text,
            sort_order=finding.sort_order,
            blocking=blocking,
        )


@strawberry.type(name="LegalReviewRunType")
class LegalReviewRunType:
    id: strawberry.ID
    title: str
    status: str
    current_stage: str = strawberry.field(name="currentStage")
    progress: int
    summary: str
    error_message: str = strawberry.field(name="errorMessage")
    input_context: GenericScalar = strawberry.field(name="inputContext")
    extracted_contract_data: GenericScalar = strawberry.field(
        name="extractedContractData"
    )
    document_id: strawberry.ID = strawberry.field(name="documentId")
    document_title: str = strawberry.field(name="documentTitle")
    document_slug: str | None = strawberry.field(name="documentSlug")
    document_pdf_url: str | None = strawberry.field(name="documentPdfUrl")
    document_text_url: str | None = strawberry.field(name="documentTextUrl")
    document_processing_status: str = strawberry.field(
        name="documentProcessingStatus"
    )
    profile: LegalReviewProfileType
    clauses: list[LegalContractClauseType]
    findings: list[LegalContractFindingType]
    total_findings: int = strawberry.field(name="totalFindings")
    pending_findings: int = strawberry.field(name="pendingFindings")
    critical_findings: int = strawberry.field(name="criticalFindings")
    high_findings: int = strawberry.field(name="highFindings")
    created_at: datetime.datetime = strawberry.field(name="createdAt")
    updated_at: datetime.datetime = strawberry.field(name="updatedAt")
    started_at: datetime.datetime | None = strawberry.field(name="startedAt")
    completed_at: datetime.datetime | None = strawberry.field(name="completedAt")

    @classmethod
    def from_model(cls, review_run: ReviewRun) -> "LegalReviewRunType":
        clauses = list(review_run.clauses.all())
        findings = list(review_run.findings.all())
        return cls(
            id=strawberry.ID(str(review_run.id)),
            title=review_run.workspace.corpus.title,
            status=review_run.status,
            current_stage=review_run.current_stage or review_run.status,
            progress=STATUS_PROGRESS.get(review_run.status, 0),
            summary=review_run.summary,
            error_message=review_run.error_message,
            input_context=review_run.input_context or {},
            extracted_contract_data=review_run.extracted_contract_data or {},
            document_id=strawberry.ID(str(review_run.document_id)),
            document_title=review_run.document.title or "未命名合同",
            document_slug=review_run.document.slug,
            document_pdf_url=_file_url(review_run.document.pdf_file),
            document_text_url=_file_url(review_run.document.txt_extract_file),
            document_processing_status=review_run.document.processing_status,
            profile=LegalReviewProfileType.from_model(review_run.review_profile),
            clauses=[LegalContractClauseType.from_model(clause) for clause in clauses],
            findings=[
                LegalContractFindingType.from_model(finding) for finding in findings
            ],
            total_findings=len(findings),
            pending_findings=sum(
                1
                for finding in findings
                if finding.review_status
                in {
                    FindingReviewStatus.PENDING,
                    FindingReviewStatus.NEEDS_FOLLOW_UP,
                }
            ),
            critical_findings=sum(
                1 for finding in findings if finding.severity == "critical"
            ),
            high_findings=sum(1 for finding in findings if finding.severity == "high"),
            created_at=review_run.created_at,
            updated_at=review_run.updated_at,
            started_at=review_run.started_at,
            completed_at=review_run.completed_at,
        )


@strawberry.type(name="LegalReviewDashboardType")
class LegalReviewDashboardType:
    total: int
    active: int
    waiting_for_review: int = strawberry.field(name="waitingForReview")
    completed: int
    high_risk_pending: int = strawberry.field(name="highRiskPending")


@strawberry.input(name="CreateContractReviewInput")
class CreateContractReviewInput:
    document_id: int = strawberry.field(name="documentId")
    review_profile_id: int = strawberry.field(name="reviewProfileId")
    title: str
    contract_type: str = strawberry.field(name="contractType")
    party_position: str = strawberry.field(name="partyPosition")
    jurisdiction: str = "CN-MAINLAND"
    counterparty: str = ""
    contract_amount: str = strawberry.field(name="contractAmount", default="")
    business_context: str = strawberry.field(name="businessContext", default="")
    involves_personal_information: bool = strawberry.field(
        name="involvesPersonalInformation", default=False
    )
    cross_border_data: bool = strawberry.field(name="crossBorderData", default=False)
    core_intellectual_property: bool = strawberry.field(
        name="coreIntellectualProperty", default=False
    )
    high_value_transaction: bool = strawberry.field(
        name="highValueTransaction", default=False
    )


@strawberry.input(name="UpdateContractFindingInput")
class UpdateContractFindingInput:
    finding_id: int = strawberry.field(name="findingId")
    review_status: str = strawberry.field(name="reviewStatus")
    reviewer_text: str | None = strawberry.field(name="reviewerText", default=None)
    suggested_replacement: str | None = strawberry.field(
        name="suggestedReplacement", default=None
    )


@strawberry.type(name="CreateContractReviewPayload")
class CreateContractReviewPayload:
    ok: bool
    message: str
    review_run: LegalReviewRunType | None = strawberry.field(name="reviewRun")


@strawberry.type(name="UpdateContractFindingPayload")
class UpdateContractFindingPayload:
    ok: bool
    message: str
    finding: LegalContractFindingType | None


@strawberry.type(name="ContractReviewActionPayload")
class ContractReviewActionPayload:
    ok: bool
    message: str
    review_run: LegalReviewRunType | None = strawberry.field(name="reviewRun")


def _review_queryset(user):
    return (
        ReviewRun.objects.filter(created_by=user)
        .select_related(
            "workspace__corpus",
            "document",
            "review_profile",
        )
        .prefetch_related(
            "review_profile__rules",
            "clauses__findings",
            "findings__playbook_rule",
        )
    )


def q_legal_review_profiles(
    info: strawberry.Info,
    enabled_only: Annotated[bool, strawberry.argument(name="enabledOnly")] = True,
) -> list[LegalReviewProfileType]:
    user = _require_user(info)
    profiles = ReviewProfile.objects.filter(owner=user).prefetch_related("rules")
    if enabled_only:
        profiles = profiles.filter(enabled=True)
    return [LegalReviewProfileType.from_model(profile) for profile in profiles]


def q_legal_review_runs(
    info: strawberry.Info,
    limit: int = 50,
) -> list[LegalReviewRunType]:
    user = _require_user(info)
    safe_limit = max(1, min(limit, 100))
    return [
        LegalReviewRunType.from_model(run)
        for run in _review_queryset(user)[:safe_limit]
    ]


def q_legal_review_run(
    info: strawberry.Info,
    id: int,
) -> LegalReviewRunType | None:
    user = _require_user(info)
    run = _review_queryset(user).filter(pk=id).first()
    return LegalReviewRunType.from_model(run) if run else None


def q_legal_review_dashboard(info: strawberry.Info) -> LegalReviewDashboardType:
    user = _require_user(info)
    runs = ReviewRun.objects.filter(created_by=user)
    return LegalReviewDashboardType(
        total=runs.count(),
        active=runs.exclude(
            status__in=[
                ReviewRunStatus.COMPLETED,
                ReviewRunStatus.CANCELLED,
                ReviewRunStatus.FAILED,
            ]
        ).count(),
        waiting_for_review=runs.filter(
            status=ReviewRunStatus.READY_FOR_REVIEW
        ).count(),
        completed=runs.filter(status=ReviewRunStatus.COMPLETED).count(),
        high_risk_pending=ContractFinding.objects.filter(
            review_run__created_by=user,
            severity__in=["critical", "high"],
            review_status__in=[
                FindingReviewStatus.PENDING,
                FindingReviewStatus.NEEDS_FOLLOW_UP,
            ],
        ).count(),
    )


def m_create_contract_review(
    info: strawberry.Info,
    input: CreateContractReviewInput,
) -> CreateContractReviewPayload:
    user = _require_user(info)
    document = Document.objects.filter(
        pk=input.document_id,
        creator=user,
        is_current=True,
    ).first()
    if document is None:
        raise GraphQLError("未找到可审查的合同文档。")

    profile = (
        ReviewProfile.objects.filter(
            pk=input.review_profile_id,
            owner=user,
            enabled=True,
        )
        .prefetch_related("rules")
        .first()
    )
    if profile is None:
        raise GraphQLError("审查规则不存在或已停用。")
    if profile.party_position not in {PartyPosition.NEUTRAL, input.party_position}:
        raise GraphQLError("所选 Playbook 与我方角色不匹配。")

    title = input.title.strip() or document.title or "合同审查"
    with transaction.atomic():
        corpus = Corpus.objects.create(
            creator=user,
            title=title[:1024],
            description=f"合同审查事项：{document.title or title}",
            is_public=False,
            allow_comments=False,
            auto_branding_enabled=False,
            memory_enabled=False,
        )
        CorpusService.grant_creator_permissions(user, corpus)
        workspace = LegalWorkspace.objects.create(
            corpus=corpus,
            owner=user,
            workspace_type=WorkspaceType.MATTER,
            matter_type=MatterType.CONTRACT,
            jurisdiction=input.jurisdiction,
            counterparty=input.counterparty.strip(),
        )
        review_run = ReviewRun.objects.create(
            workspace=workspace,
            document=document,
            review_profile=profile,
            created_by=user,
            status=ReviewRunStatus.PENDING,
            current_stage=ReviewRunStatus.PENDING,
            input_context={
                "contract_type": input.contract_type,
                "party_position": input.party_position,
                "jurisdiction": input.jurisdiction,
                "counterparty": input.counterparty.strip(),
                "contract_amount": input.contract_amount.strip(),
                "business_context": input.business_context.strip(),
                "involves_personal_information": input.involves_personal_information,
                "cross_border_data": input.cross_border_data,
                "core_intellectual_property": input.core_intellectual_property,
                "high_value_transaction": input.high_value_transaction,
            },
        )
        transaction.on_commit(lambda: run_contract_review_task.delay(review_run.id))

    run = _review_queryset(user).get(pk=review_run.id)
    return CreateContractReviewPayload(
        ok=True,
        message="合同已进入审查队列。",
        review_run=LegalReviewRunType.from_model(run),
    )


def m_update_contract_finding(
    info: strawberry.Info,
    input: UpdateContractFindingInput,
) -> UpdateContractFindingPayload:
    user = _require_user(info)
    if input.review_status not in FindingReviewStatus.values:
        raise GraphQLError("不支持的风险处理状态。")
    finding = (
        ContractFinding.objects.select_related(
            "review_run__created_by", "playbook_rule", "clause"
        )
        .filter(pk=input.finding_id, review_run__created_by=user)
        .first()
    )
    if finding is None:
        raise GraphQLError("风险项不存在。")

    finding.review_status = input.review_status
    if input.reviewer_text is not None:
        finding.reviewer_text = input.reviewer_text
    if input.suggested_replacement is not None:
        finding.suggested_replacement = input.suggested_replacement
    finding.save(
        update_fields=[
            "review_status",
            "reviewer_text",
            "suggested_replacement",
            "updated_at",
        ]
    )
    return UpdateContractFindingPayload(
        ok=True,
        message="风险处理结果已保存。",
        finding=LegalContractFindingType.from_model(finding),
    )


def m_restart_contract_review(
    info: strawberry.Info,
    id: int,
) -> ContractReviewActionPayload:
    user = _require_user(info)
    run = _review_queryset(user).filter(pk=id).first()
    if run is None:
        raise GraphQLError("审查任务不存在。")
    run.status = ReviewRunStatus.PENDING
    run.current_stage = ReviewRunStatus.PENDING
    run.error_message = ""
    run.completed_at = None
    run.save(
        update_fields=[
            "status",
            "current_stage",
            "error_message",
            "completed_at",
            "updated_at",
        ]
    )
    transaction.on_commit(lambda: run_contract_review_task.delay(run.id))
    return ContractReviewActionPayload(
        ok=True,
        message="合同已重新进入审查队列。",
        review_run=LegalReviewRunType.from_model(run),
    )


def m_complete_contract_review(
    info: strawberry.Info,
    id: int,
) -> ContractReviewActionPayload:
    user = _require_user(info)
    run = _review_queryset(user).filter(pk=id).first()
    if run is None:
        raise GraphQLError("审查任务不存在。")
    if run.status != ReviewRunStatus.READY_FOR_REVIEW:
        raise GraphQLError("只有等待人工复核的任务才能完成。")
    unresolved = run.findings.filter(
        review_status__in=[
            FindingReviewStatus.PENDING,
            FindingReviewStatus.NEEDS_FOLLOW_UP,
        ]
    ).count()
    if unresolved:
        raise GraphQLError(f"仍有 {unresolved} 项风险尚未完成处理。")
    run.transition_to(ReviewRunStatus.COMPLETED, save=True)
    run.workspace.matter_status = "completed"
    run.workspace.save(update_fields=["matter_status", "updated_at"])
    return ContractReviewActionPayload(
        ok=True,
        message="合同审查已完成。",
        review_run=LegalReviewRunType.from_model(run),
    )


QUERY_FIELDS = {
    "legal_review_profiles": strawberry.field(
        resolver=q_legal_review_profiles,
        name="legalReviewProfiles",
    ),
    "legal_review_runs": strawberry.field(
        resolver=q_legal_review_runs,
        name="legalReviewRuns",
    ),
    "legal_review_run": strawberry.field(
        resolver=q_legal_review_run,
        name="legalReviewRun",
    ),
    "legal_review_dashboard": strawberry.field(
        resolver=q_legal_review_dashboard,
        name="legalReviewDashboard",
    ),
}

MUTATION_FIELDS = {
    "create_contract_review": strawberry.field(
        resolver=m_create_contract_review,
        name="createContractReview",
    ),
    "update_contract_finding": strawberry.field(
        resolver=m_update_contract_finding,
        name="updateContractFinding",
    ),
    "restart_contract_review": strawberry.field(
        resolver=m_restart_contract_review,
        name="restartContractReview",
    ),
    "complete_contract_review": strawberry.field(
        resolver=m_complete_contract_review,
        name="completeContractReview",
    ),
}
