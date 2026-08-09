from django.db import models


class WorkspaceType(models.TextChoices):
    MATTER = "matter", "法务事项"
    AUTHORITY = "authority", "法律法规库"
    PLAYBOOK = "playbook", "审查规则库"
    TEMPLATE = "template", "模板与范本库"


class MatterType(models.TextChoices):
    CONTRACT = "contract", "合同"
    EMPLOYMENT = "employment", "劳动人事"
    COMPLIANCE = "compliance", "合规"
    DISPUTE = "dispute", "争议"
    GENERAL = "general", "综合事项"


class MatterStatus(models.TextChoices):
    ACTIVE = "active", "进行中"
    WAITING = "waiting", "待补充"
    COMPLETED = "completed", "已完成"
    ARCHIVED = "archived", "已归档"


class Confidentiality(models.TextChoices):
    NORMAL = "normal", "普通"
    CONFIDENTIAL = "confidential", "机密"
    HIGHLY_CONFIDENTIAL = "highly_confidential", "高度机密"


class PartyPosition(models.TextChoices):
    BUYER = "buyer", "采购方"
    SELLER = "seller", "供应方"
    EMPLOYER = "employer", "用人单位"
    EMPLOYEE = "employee", "劳动者"
    DISCLOSER = "discloser", "披露方"
    RECIPIENT = "recipient", "接收方"
    NEUTRAL = "neutral", "中立审查"


class RiskSeverity(models.TextChoices):
    CRITICAL = "critical", "严重"
    HIGH = "high", "高"
    MEDIUM = "medium", "中"
    LOW = "low", "低"
    INFO = "info", "提示"


class ReviewRunStatus(models.TextChoices):
    PENDING = "pending", "等待执行"
    WAITING_FOR_DOCUMENT = "waiting_for_document", "等待文档"
    PARSING = "parsing", "解析文档"
    EXTRACTING = "extracting", "提取合同事实"
    MATCHING_RULES = "matching_rules", "匹配审查规则"
    ANALYZING = "analyzing", "分析风险"
    VERIFYING = "verifying", "核验证据"
    READY_FOR_REVIEW = "ready_for_review", "等待人工复核"
    COMPLETED = "completed", "已完成"
    FAILED = "failed", "失败"
    CANCELLED = "cancelled", "已取消"


class EvidenceType(models.TextChoices):
    CONTRACT_TEXT = "contract_text", "合同原文"
    LAW = "law", "法律依据"
    INTERNAL_RULE = "internal_rule", "内部规则"
    TEMPLATE = "template", "标准模板"
    HISTORICAL_EXAMPLE = "historical_example", "历史案例"


class VerificationStatus(models.TextChoices):
    UNVERIFIED = "unverified", "未核验"
    VERIFIED = "verified", "已核验"
    NEEDS_CONFIRMATION = "needs_confirmation", "待确认"
    REJECTED = "rejected", "证据不成立"


class FindingReviewStatus(models.TextChoices):
    PENDING = "pending", "待复核"
    ACCEPTED = "accepted", "已接受"
    EDITED = "edited", "编辑后接受"
    REJECTED = "rejected", "已驳回"
    NEEDS_FOLLOW_UP = "needs_follow_up", "待补充"


class ResearchRunStatus(models.TextChoices):
    PENDING = "pending", "等待执行"
    RETRIEVING = "retrieving", "检索资料"
    DRAFTING = "drafting", "生成初稿"
    VERIFYING = "verifying", "核验引用"
    READY_FOR_REVIEW = "ready_for_review", "等待复核"
    COMPLETED = "completed", "已完成"
    FAILED = "failed", "失败"
    CANCELLED = "cancelled", "已取消"
