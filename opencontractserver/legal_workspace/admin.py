from django.contrib import admin

from opencontractserver.legal_workspace.models import (
    ContractClause,
    ContractFinding,
    LegalWorkspace,
    PlaybookRule,
    ResearchRun,
    ReviewProfile,
    ReviewRun,
)


@admin.register(LegalWorkspace)
class LegalWorkspaceAdmin(admin.ModelAdmin):
    list_display = (
        "corpus",
        "workspace_type",
        "matter_type",
        "matter_status",
        "jurisdiction",
        "owner",
        "updated_at",
    )
    list_filter = (
        "workspace_type",
        "matter_type",
        "matter_status",
        "confidentiality",
        "jurisdiction",
    )
    search_fields = ("corpus__title", "counterparty", "business_department")
    raw_id_fields = ("corpus", "owner")


class PlaybookRuleInline(admin.TabularInline):
    model = PlaybookRule
    extra = 0
    fields = ("sort_order", "category", "title", "severity", "enabled")


@admin.register(ReviewProfile)
class ReviewProfileAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "version",
        "contract_type",
        "party_position",
        "jurisdiction",
        "enabled",
        "owner",
    )
    list_filter = ("enabled", "contract_type", "party_position", "jurisdiction")
    search_fields = ("name", "description")
    raw_id_fields = ("owner",)
    inlines = (PlaybookRuleInline,)


@admin.register(PlaybookRule)
class PlaybookRuleAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "review_profile",
        "category",
        "severity",
        "sort_order",
        "enabled",
    )
    list_filter = ("enabled", "severity", "category")
    search_fields = ("title", "description", "standard_position")
    raw_id_fields = ("review_profile",)


@admin.register(ReviewRun)
class ReviewRunAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "workspace",
        "document",
        "review_profile",
        "status",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "review_profile", "created_at")
    search_fields = ("document__title", "workspace__corpus__title", "summary")
    raw_id_fields = ("workspace", "document", "review_profile", "created_by")
    readonly_fields = ("created_at", "updated_at", "started_at", "completed_at")


@admin.register(ContractClause)
class ContractClauseAdmin(admin.ModelAdmin):
    list_display = (
        "heading",
        "review_run",
        "clause_type",
        "sort_order",
        "confidence",
    )
    list_filter = ("clause_type",)
    search_fields = ("heading", "text", "review_run__document__title")
    raw_id_fields = ("review_run",)


@admin.register(ContractFinding)
class ContractFindingAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "review_run",
        "severity",
        "verification_status",
        "review_status",
        "confidence",
    )
    list_filter = (
        "severity",
        "verification_status",
        "review_status",
        "category",
    )
    search_fields = ("title", "risk_summary", "source_quote")
    raw_id_fields = ("review_run", "clause", "source_annotation", "playbook_rule")
    filter_horizontal = ("legal_basis_annotations",)


@admin.register(ResearchRun)
class ResearchRunAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "workspace",
        "status",
        "jurisdiction",
        "cutoff_date",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "jurisdiction", "cutoff_date")
    search_fields = ("question", "answer", "workspace__corpus__title")
    raw_id_fields = ("workspace", "created_by")
    filter_horizontal = ("source_annotations",)
