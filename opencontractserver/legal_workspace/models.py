from __future__ import annotations

from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from opencontractserver.legal_workspace.enums import (
    Confidentiality,
    EvidenceType,
    FindingReviewStatus,
    MatterStatus,
    MatterType,
    PartyPosition,
    ResearchRunStatus,
    ReviewRunStatus,
    RiskSeverity,
    VerificationStatus,
    WorkspaceType,
)


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LegalWorkspace(TimeStampedModel):
    """Legal semantics layered over an OpenContracts ``Corpus``.

    The corpus remains the source of truth for documents, annotations, search,
    conversations and agent context. This model only adds legal-work metadata.
    """

    corpus = models.OneToOneField(
        "corpuses.Corpus",
        on_delete=models.CASCADE,
        related_name="legal_workspace",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="legal_workspaces",
    )
    workspace_type = models.CharField(
        max_length=32,
        choices=WorkspaceType.choices,
        default=WorkspaceType.MATTER,
        db_index=True,
    )
    matter_type = models.CharField(
        max_length=32,
        choices=MatterType.choices,
        default=MatterType.GENERAL,
        db_index=True,
    )
    matter_status = models.CharField(
        max_length=32,
        choices=MatterStatus.choices,
        default=MatterStatus.ACTIVE,
        db_index=True,
    )
    jurisdiction = models.CharField(max_length=64, default="CN-MAINLAND", db_index=True)
    counterparty = models.CharField(max_length=512, blank=True, default="")
    business_department = models.CharField(max_length=255, blank=True, default="")
    confidentiality = models.CharField(
        max_length=32,
        choices=Confidentiality.choices,
        default=Confidentiality.CONFIDENTIAL,
    )
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-updated_at",)
        indexes = [
            models.Index(fields=["owner", "workspace_type"]),
            models.Index(fields=["owner", "matter_status"]),
            models.Index(fields=["jurisdiction", "workspace_type"]),
        ]

    def clean(self) -> None:
        super().clean()
        if self.corpus_id and self.owner_id and self.corpus.creator_id != self.owner_id:
            raise ValidationError(
                {"owner": "法务工作区所有者必须与底层 Corpus 创建者一致。"}
            )
        if self.workspace_type != WorkspaceType.MATTER and self.closed_at:
            raise ValidationError(
                {"closed_at": "知识库工作区不使用事项关闭时间。"}
            )

    @property
    def is_matter(self) -> bool:
        return self.workspace_type == WorkspaceType.MATTER

    def __str__(self) -> str:
        return f"{self.get_workspace_type_display()} · {self.corpus.title}"


class ReviewProfile(TimeStampedModel):
    """Versioned contract-review policy for one role and jurisdiction."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="legal_review_profiles",
    )
    name = models.CharField(max_length=255)
    contract_type = models.CharField(max_length=128, db_index=True)
    party_position = models.CharField(
        max_length=32,
        choices=PartyPosition.choices,
        default=PartyPosition.NEUTRAL,
        db_index=True,
    )
    jurisdiction = models.CharField(max_length=64, default="CN-MAINLAND", db_index=True)
    description = models.TextField(blank=True, default="")
    enabled = models.BooleanField(default=True, db_index=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ("name", "-version")
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name", "version"],
                name="legal_unique_review_profile_version",
            )
        ]
        indexes = [
            models.Index(fields=["owner", "enabled"]),
            models.Index(fields=["contract_type", "party_position", "jurisdiction"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} v{self.version}"


class PlaybookRule(TimeStampedModel):
    """A deterministic review rule used before and alongside LLM analysis."""

    review_profile = models.ForeignKey(
        ReviewProfile,
        on_delete=models.CASCADE,
        related_name="rules",
    )
    category = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    severity = models.CharField(
        max_length=16,
        choices=RiskSeverity.choices,
        default=RiskSeverity.MEDIUM,
        db_index=True,
    )
    required_terms = models.JSONField(default=list, blank=True)
    prohibited_terms = models.JSONField(default=list, blank=True)
    standard_position = models.TextField(blank=True, default="")
    fallback_position = models.TextField(blank=True, default="")
    suggested_language = models.TextField(blank=True, default="")
    legal_basis_description = models.TextField(blank=True, default="")
    sort_order = models.IntegerField(default=0)
    enabled = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["review_profile", "title"],
                name="legal_unique_rule_title_per_profile",
            )
        ]
        indexes = [
            models.Index(fields=["review_profile", "enabled", "sort_order"]),
            models.Index(fields=["category", "severity"]),
        ]

    def __str__(self) -> str:
        return f"{self.review_profile.name} · {self.title}"


class ReviewRun(TimeStampedModel):
    """One auditable contract-review execution."""

    ALLOWED_TRANSITIONS: ClassVar[dict[str, set[str]]] = {
        ReviewRunStatus.PENDING: {
            ReviewRunStatus.WAITING_FOR_DOCUMENT,
            ReviewRunStatus.PARSING,
            ReviewRunStatus.CANCELLED,
            ReviewRunStatus.FAILED,
        },
        ReviewRunStatus.WAITING_FOR_DOCUMENT: {
            ReviewRunStatus.PARSING,
            ReviewRunStatus.CANCELLED,
            ReviewRunStatus.FAILED,
        },
        ReviewRunStatus.PARSING: {
            ReviewRunStatus.EXTRACTING,
            ReviewRunStatus.FAILED,
            ReviewRunStatus.CANCELLED,
        },
        ReviewRunStatus.EXTRACTING: {
            ReviewRunStatus.MATCHING_RULES,
            ReviewRunStatus.FAILED,
            ReviewRunStatus.CANCELLED,
        },
        ReviewRunStatus.MATCHING_RULES: {
            ReviewRunStatus.ANALYZING,
            ReviewRunStatus.FAILED,
            ReviewRunStatus.CANCELLED,
        },
        ReviewRunStatus.ANALYZING: {
            ReviewRunStatus.VERIFYING,
            ReviewRunStatus.FAILED,
            ReviewRunStatus.CANCELLED,
        },
        ReviewRunStatus.VERIFYING: {
            ReviewRunStatus.READY_FOR_REVIEW,
            ReviewRunStatus.FAILED,
            ReviewRunStatus.CANCELLED,
        },
        ReviewRunStatus.READY_FOR_REVIEW: {
            ReviewRunStatus.COMPLETED,
            ReviewRunStatus.ANALYZING,
            ReviewRunStatus.CANCELLED,
        },
        ReviewRunStatus.COMPLETED: set(),
        ReviewRunStatus.FAILED: {ReviewRunStatus.PENDING},
        ReviewRunStatus.CANCELLED: {ReviewRunStatus.PENDING},
    }

    workspace = models.ForeignKey(
        LegalWorkspace,
        on_delete=models.CASCADE,
        related_name="review_runs",
    )
    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.PROTECT,
        related_name="legal_review_runs",
    )
    review_profile = models.ForeignKey(
        ReviewProfile,
        on_delete=models.PROTECT,
        related_name="review_runs",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_legal_review_runs",
    )
    status = models.CharField(
        max_length=32,
        choices=ReviewRunStatus.choices,
        default=ReviewRunStatus.PENDING,
        db_index=True,
    )
    current_stage = models.CharField(max_length=64, blank=True, default="")
    input_context = models.JSONField(default=dict, blank=True)
    extracted_contract_data = models.JSONField(default=dict, blank=True)
    summary = models.TextField(blank=True, default="")
    model_name = models.CharField(max_length=128, blank=True, default="")
    prompt_version = models.CharField(max_length=64, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["document", "created_at"]),
            models.Index(fields=["created_by", "created_at"]),
        ]

    def clean(self) -> None:
        super().clean()
        if self.workspace_id and not self.workspace.is_matter:
            raise ValidationError({"workspace": "合同审查只能归属于法务事项。"})
        if (
            self.review_profile_id
            and self.workspace_id
            and self.review_profile.owner_id != self.workspace.owner_id
        ):
            raise ValidationError({"review_profile": "审查规则必须属于事项所有者。"})

    def transition_to(self, new_status: str, *, save: bool = False) -> None:
        if new_status == self.status:
            return
        allowed = self.ALLOWED_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise ValidationError(
                f"非法审查状态迁移：{self.status} -> {new_status}"
            )
        now = timezone.now()
        self.status = new_status
        self.current_stage = new_status
        if new_status == ReviewRunStatus.PARSING and self.started_at is None:
            self.started_at = now
        if new_status in {
            ReviewRunStatus.COMPLETED,
            ReviewRunStatus.FAILED,
            ReviewRunStatus.CANCELLED,
        }:
            self.completed_at = now
        if save:
            self.save(
                update_fields=[
                    "status",
                    "current_stage",
                    "started_at",
                    "completed_at",
                    "updated_at",
                ]
            )

    def __str__(self) -> str:
        return f"ReviewRun#{self.pk or 'new'} · {self.document.title or self.document_id}"


class ContractFinding(TimeStampedModel):
    """A risk finding bound to exact source evidence and an optional playbook rule."""

    review_run = models.ForeignKey(
        ReviewRun,
        on_delete=models.CASCADE,
        related_name="findings",
    )
    category = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    severity = models.CharField(
        max_length=16,
        choices=RiskSeverity.choices,
        default=RiskSeverity.MEDIUM,
        db_index=True,
    )
    evidence_type = models.CharField(
        max_length=32,
        choices=EvidenceType.choices,
        default=EvidenceType.CONTRACT_TEXT,
    )
    risk_summary = models.TextField()
    source_quote = models.TextField()
    source_annotation = models.ForeignKey(
        "annotations.Annotation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legal_findings_as_source",
    )
    page_number = models.PositiveIntegerField(null=True, blank=True)
    playbook_rule = models.ForeignKey(
        PlaybookRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="findings",
    )
    legal_basis_annotations = models.ManyToManyField(
        "annotations.Annotation",
        blank=True,
        related_name="legal_findings_as_basis",
    )
    recommended_action = models.TextField(blank=True, default="")
    suggested_replacement = models.TextField(blank=True, default="")
    confidence = models.FloatField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=32,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNVERIFIED,
        db_index=True,
    )
    review_status = models.CharField(
        max_length=32,
        choices=FindingReviewStatus.choices,
        default=FindingReviewStatus.PENDING,
        db_index=True,
    )
    reviewer_text = models.TextField(blank=True, default="")
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "id")
        indexes = [
            models.Index(fields=["review_run", "severity", "sort_order"]),
            models.Index(fields=["review_run", "verification_status"]),
            models.Index(fields=["review_run", "review_status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(confidence__isnull=True)
                | (Q(confidence__gte=0.0) & Q(confidence__lte=1.0)),
                name="legal_finding_confidence_between_zero_and_one",
            )
        ]

    def clean(self) -> None:
        super().clean()
        if self.confidence is not None and not 0.0 <= self.confidence <= 1.0:
            raise ValidationError({"confidence": "置信度必须位于 0 到 1 之间。"})
        if self.verification_status == VerificationStatus.VERIFIED:
            if not self.source_annotation_id or not self.source_quote.strip():
                raise ValidationError(
                    "已核验风险必须同时保留原文批注和非空原文摘录。"
                )

    def __str__(self) -> str:
        return f"{self.get_severity_display()} · {self.title}"


class ResearchRun(TimeStampedModel):
    """A scoped, cited legal-research task stored inside a matter."""

    workspace = models.ForeignKey(
        LegalWorkspace,
        on_delete=models.CASCADE,
        related_name="research_runs",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_legal_research_runs",
    )
    question = models.TextField()
    jurisdiction = models.CharField(max_length=64, default="CN-MAINLAND", db_index=True)
    cutoff_date = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=32,
        choices=ResearchRunStatus.choices,
        default=ResearchRunStatus.PENDING,
        db_index=True,
    )
    scope = models.JSONField(default=dict, blank=True)
    answer = models.TextField(blank=True, default="")
    limitations = models.TextField(blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    source_annotations = models.ManyToManyField(
        "annotations.Annotation",
        blank=True,
        related_name="legal_research_runs",
    )
    model_name = models.CharField(max_length=128, blank=True, default="")
    prompt_version = models.CharField(max_length=64, blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["created_by", "created_at"]),
            models.Index(fields=["jurisdiction", "cutoff_date"]),
        ]

    def clean(self) -> None:
        super().clean()
        if self.workspace_id and not self.workspace.is_matter:
            raise ValidationError({"workspace": "法律研究任务必须归属于法务事项。"})

    def __str__(self) -> str:
        return f"ResearchRun#{self.pk or 'new'} · {self.question[:48]}"
