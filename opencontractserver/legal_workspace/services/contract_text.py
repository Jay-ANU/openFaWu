from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence


ARTICLE_HEADING_RE = re.compile(
    r"^(?:"
    r"第[一二三四五六七八九十百千零〇两\d]+条(?:\s*[：:、.．]?\s*[^\n]{0,48})?"
    r"|\d+(?:\.\d+){0,3}\s*[、.．)]\s*[^\n]{1,72}"
    r"|[一二三四五六七八九十百]+\s*[、.．)]\s*[^\n]{1,72}"
    r")$"
)

PLACEHOLDER_RE = re.compile(
    r"(?:_{4,}|（\s*待填\s*）|\[\s*待填\s*\]|【\s*待填\s*】|"
    r"【\s*】|\[\s*]|\{\{[^}]+}}|<[^>]{1,40}>)"
)

LIABILITY_TERMS = ("赔偿", "违约责任", "损失", "责任")
LIABILITY_CAP_TERMS = ("责任上限", "累计责任", "不超过", "最高以", "赔偿上限")
RENEWAL_TERMS = ("自动续期", "自动续展", "自动延长")
RENEWAL_NOTICE_TERMS = ("提前通知", "书面通知", "续期提醒", "到期前")
PERSONAL_DATA_TERMS = ("个人信息", "个人数据", "敏感个人信息")
DATA_GUARD_TERMS = ("安全事件", "数据泄露", "分包", "删除", "返还")

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "subject": ("合同标的", "服务内容", "产品", "交付"),
    "payment": ("付款", "支付", "价款", "费用", "发票"),
    "acceptance": ("验收", "交付", "测试", "确认"),
    "intellectual_property": ("知识产权", "著作权", "专利", "商标", "成果"),
    "confidentiality": ("保密", "商业秘密", "机密信息"),
    "data_processing": ("个人信息", "数据", "隐私", "网络安全"),
    "liability": ("责任", "赔偿", "违约", "损失"),
    "termination": ("解除", "终止", "届满"),
    "renewal": ("续期", "续展", "延长"),
    "dispute": ("争议", "管辖", "仲裁", "适用法律"),
    "force_majeure": ("不可抗力",),
}


@dataclass(frozen=True)
class ParsedClause:
    clause_type: str
    heading: str
    text: str
    source_start: int
    source_end: int
    sort_order: int
    confidence: float


@dataclass(frozen=True)
class RuleSpec:
    rule_id: int | None
    category: str
    title: str
    severity: str
    description: str
    required_terms: tuple[str, ...]
    prohibited_terms: tuple[str, ...]
    required_terms_mode: str
    standard_position: str
    fallback_position: str
    suggested_language: str
    business_question: str
    applicability: Mapping[str, Any]
    blocking: bool


@dataclass(frozen=True)
class FindingDraft:
    category: str
    title: str
    severity: str
    risk_type: str
    risk_summary: str
    source_quote: str
    source_start: int | None
    source_end: int | None
    clause_index: int | None
    business_impact: str
    recommended_action: str
    suggested_replacement: str
    fallback_position: str
    required_confirmation: str
    confidence: float
    rule_id: int | None = None
    rule_snapshot: Mapping[str, Any] | None = None


def normalize_contract_text(text: str) -> str:
    """Normalize newlines without changing character offsets unnecessarily."""

    return text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")


def _looks_like_heading(value: str) -> bool:
    stripped = value.strip()
    if not stripped or len(stripped) > 88:
        return False
    return ARTICLE_HEADING_RE.fullmatch(stripped) is not None


def infer_clause_type(heading: str, body: str) -> str:
    haystack = f"{heading}\n{body[:500]}".lower()
    best_category = "other"
    best_score = 0
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword.lower() in haystack)
        if score > best_score:
            best_category = category
            best_score = score
    return best_category


def parse_contract_clauses(text: str, *, max_fallback_chars: int = 1800) -> list[ParsedClause]:
    """Split a contract into auditable clauses with stable character offsets.

    Chinese article headings and common numbered headings are preferred. When
    the document has no recognizable headings, paragraph groups are used so the
    review UI still receives navigable sections instead of one giant blob.
    """

    normalized = normalize_contract_text(text)
    if not normalized.strip():
        return []

    lines = normalized.splitlines(keepends=True)
    offset = 0
    headings: list[tuple[int, int, str]] = []
    for line in lines:
        start = offset
        offset += len(line)
        if _looks_like_heading(line):
            headings.append((start, offset, line.strip()))

    clauses: list[ParsedClause] = []
    if headings:
        prefix = normalized[: headings[0][0]].strip()
        if prefix:
            prefix_start = normalized.find(prefix)
            clauses.append(
                ParsedClause(
                    clause_type="preamble",
                    heading="合同基本信息",
                    text=prefix,
                    source_start=prefix_start,
                    source_end=prefix_start + len(prefix),
                    sort_order=0,
                    confidence=0.9,
                )
            )

        for index, (heading_start, _heading_end, heading) in enumerate(headings):
            clause_end = headings[index + 1][0] if index + 1 < len(headings) else len(normalized)
            raw = normalized[heading_start:clause_end]
            text_value = raw.strip()
            leading_trim = len(raw) - len(raw.lstrip())
            start = heading_start + leading_trim
            end = start + len(text_value)
            clauses.append(
                ParsedClause(
                    clause_type=infer_clause_type(heading, text_value),
                    heading=heading,
                    text=text_value,
                    source_start=start,
                    source_end=end,
                    sort_order=len(clauses),
                    confidence=0.96,
                )
            )
        return clauses

    paragraph_re = re.compile(r"\n\s*\n+")
    cursor = 0
    buffer_start: int | None = None
    buffer_parts: list[str] = []
    buffer_end = 0

    def flush() -> None:
        nonlocal buffer_start, buffer_parts, buffer_end
        if buffer_start is None or not buffer_parts:
            return
        value = "\n\n".join(buffer_parts).strip()
        if value:
            clauses.append(
                ParsedClause(
                    clause_type=infer_clause_type("", value),
                    heading=f"文本片段 {len(clauses) + 1}",
                    text=value,
                    source_start=buffer_start,
                    source_end=buffer_end,
                    sort_order=len(clauses),
                    confidence=0.66,
                )
            )
        buffer_start = None
        buffer_parts = []
        buffer_end = 0

    for match in paragraph_re.finditer(normalized):
        paragraph = normalized[cursor : match.start()].strip()
        if paragraph:
            paragraph_start = normalized.find(paragraph, cursor, match.start())
            if buffer_start is None:
                buffer_start = paragraph_start
            projected = sum(len(part) for part in buffer_parts) + len(paragraph)
            if buffer_parts and projected > max_fallback_chars:
                flush()
                buffer_start = paragraph_start
            buffer_parts.append(paragraph)
            buffer_end = paragraph_start + len(paragraph)
        cursor = match.end()

    tail = normalized[cursor:].strip()
    if tail:
        tail_start = normalized.find(tail, cursor)
        if buffer_start is None:
            buffer_start = tail_start
        projected = sum(len(part) for part in buffer_parts) + len(tail)
        if buffer_parts and projected > max_fallback_chars:
            flush()
            buffer_start = tail_start
        buffer_parts.append(tail)
        buffer_end = tail_start + len(tail)
    flush()

    if not clauses:
        value = normalized.strip()
        start = normalized.find(value)
        clauses.append(
            ParsedClause(
                clause_type=infer_clause_type("", value),
                heading="合同正文",
                text=value,
                source_start=start,
                source_end=start + len(value),
                sort_order=0,
                confidence=0.5,
            )
        )
    return clauses


def snippet_around(text: str, start: int, end: int, *, radius: int = 140) -> str:
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    snippet = text[left:right].strip()
    if left > 0:
        snippet = f"…{snippet}"
    if right < len(text):
        snippet = f"{snippet}…"
    return snippet


def find_clause_index(clauses: Sequence[ParsedClause], position: int) -> int | None:
    for index, clause in enumerate(clauses):
        if clause.source_start <= position < clause.source_end:
            return index
    return None


def is_rule_applicable(
    rule: RuleSpec,
    *,
    text: str,
    context: Mapping[str, Any],
) -> bool:
    applicability = dict(rule.applicability or {})

    contract_types = tuple(str(v) for v in applicability.get("contract_types", []) if v)
    if contract_types and str(context.get("contract_type", "")) not in contract_types:
        return False

    party_positions = tuple(
        str(v) for v in applicability.get("party_positions", []) if v
    )
    if party_positions and str(context.get("party_position", "")) not in party_positions:
        return False

    true_flags = tuple(
        str(v) for v in applicability.get("requires_any_context_true", []) if v
    )
    if true_flags and not any(bool(context.get(flag)) for flag in true_flags):
        return False

    all_true_flags = tuple(
        str(v) for v in applicability.get("requires_all_context_true", []) if v
    )
    if all_true_flags and not all(bool(context.get(flag)) for flag in all_true_flags):
        return False

    document_terms = tuple(
        str(v) for v in applicability.get("document_contains_any", []) if v
    )
    if document_terms and not any(term in text for term in document_terms):
        return False

    return True


def _rule_snapshot(rule: RuleSpec) -> dict[str, Any]:
    return {
        "category": rule.category,
        "title": rule.title,
        "severity": rule.severity,
        "description": rule.description,
        "required_terms": list(rule.required_terms),
        "prohibited_terms": list(rule.prohibited_terms),
        "required_terms_mode": rule.required_terms_mode,
        "standard_position": rule.standard_position,
        "fallback_position": rule.fallback_position,
        "suggested_language": rule.suggested_language,
        "business_question": rule.business_question,
        "blocking": rule.blocking,
    }


def evaluate_playbook_rules(
    text: str,
    clauses: Sequence[ParsedClause],
    rules: Iterable[RuleSpec],
    context: Mapping[str, Any],
) -> list[FindingDraft]:
    findings: list[FindingDraft] = []
    for rule in rules:
        if not is_rule_applicable(rule, text=text, context=context):
            continue

        for prohibited in rule.prohibited_terms:
            search_from = 0
            while prohibited:
                position = text.find(prohibited, search_from)
                if position < 0:
                    break
                end = position + len(prohibited)
                clause_index = find_clause_index(clauses, position)
                findings.append(
                    FindingDraft(
                        category=rule.category,
                        title=rule.title,
                        severity=rule.severity,
                        risk_type="prohibited_term",
                        risk_summary=(
                            f"合同出现审查规则禁止或需要重点限制的表述“{prohibited}”。"
                            f" {rule.description}".strip()
                        ),
                        source_quote=snippet_around(text, position, end),
                        source_start=position,
                        source_end=end,
                        clause_index=clause_index,
                        business_impact=rule.standard_position,
                        recommended_action="修改或删除该表述，并按照标准立场重新限定权利义务。",
                        suggested_replacement=rule.suggested_language,
                        fallback_position=rule.fallback_position,
                        required_confirmation=rule.business_question,
                        confidence=0.98,
                        rule_id=rule.rule_id,
                        rule_snapshot=_rule_snapshot(rule),
                    )
                )
                search_from = end

        if rule.required_terms:
            present = {term: term in text for term in rule.required_terms}
            if rule.required_terms_mode == "any":
                failed = not any(present.values())
                missing_terms = list(rule.required_terms) if failed else []
            else:
                missing_terms = [term for term, exists in present.items() if not exists]
                failed = bool(missing_terms)

            if failed:
                relevant_index = next(
                    (
                        index
                        for index, clause in enumerate(clauses)
                        if clause.clause_type == rule.category
                    ),
                    None,
                )
                relevant_clause = clauses[relevant_index] if relevant_index is not None else None
                quote = (
                    relevant_clause.text[:420]
                    if relevant_clause is not None
                    else text[:420].strip()
                )
                findings.append(
                    FindingDraft(
                        category=rule.category,
                        title=rule.title,
                        severity=rule.severity,
                        risk_type="missing_required_term",
                        risk_summary=(
                            "未识别到审查规则要求覆盖的关键内容："
                            + "、".join(missing_terms)
                            + "。"
                        ),
                        source_quote=quote,
                        source_start=(
                            relevant_clause.source_start if relevant_clause is not None else 0
                        ),
                        source_end=(
                            relevant_clause.source_end
                            if relevant_clause is not None
                            else min(len(text), len(quote))
                        ),
                        clause_index=relevant_index,
                        business_impact=rule.standard_position,
                        recommended_action="补充缺失内容，并由业务确认实际履约安排。",
                        suggested_replacement=rule.suggested_language,
                        fallback_position=rule.fallback_position,
                        required_confirmation=rule.business_question,
                        confidence=0.9,
                        rule_id=rule.rule_id,
                        rule_snapshot=_rule_snapshot(rule),
                    )
                )

    return findings


def evaluate_generic_checks(
    text: str,
    clauses: Sequence[ParsedClause],
    context: Mapping[str, Any],
) -> list[FindingDraft]:
    findings: list[FindingDraft] = []

    placeholder = PLACEHOLDER_RE.search(text)
    if placeholder:
        findings.append(
            FindingDraft(
                category="completeness",
                title="合同仍存在未填写或占位内容",
                severity="medium",
                risk_type="placeholder",
                risk_summary="合同中存在待填字段或模板占位符，签署前可能形成主体、金额、日期或义务范围不确定。",
                source_quote=snippet_around(text, placeholder.start(), placeholder.end()),
                source_start=placeholder.start(),
                source_end=placeholder.end(),
                clause_index=find_clause_index(clauses, placeholder.start()),
                business_impact="未填写字段可能使合同无法执行或导致双方理解不一致。",
                recommended_action="补齐全部占位字段，并在签署前再次执行完整性检查。",
                suggested_replacement="",
                fallback_position="",
                required_confirmation="请确认占位字段的最终内容和责任人。",
                confidence=0.99,
            )
        )

    has_liability = any(term in text for term in LIABILITY_TERMS)
    has_cap = any(term in text for term in LIABILITY_CAP_TERMS)
    if has_liability and not has_cap:
        position = min(
            (text.find(term) for term in LIABILITY_TERMS if text.find(term) >= 0),
            default=0,
        )
        findings.append(
            FindingDraft(
                category="liability",
                title="未识别到明确的累计责任上限",
                severity="high",
                risk_type="missing_liability_cap",
                risk_summary="合同包含赔偿或违约责任安排，但未识别到责任上限、不超过或最高责任等限制性表述。",
                source_quote=snippet_around(text, position, position + 2),
                source_start=position,
                source_end=position + 2,
                clause_index=find_clause_index(clauses, position),
                business_impact="在争议情形下，我方责任可能超过合同收益或交易金额。",
                recommended_action="增加累计责任上限，并单独审查例外是否会架空该上限。",
                suggested_replacement="除法律另有强制规定外，任一方在本合同项下承担的累计赔偿责任不超过本合同已支付或应支付的合同价款总额。",
                fallback_position="对故意或重大过失、保密义务及知识产权侵权可设置有限例外。",
                required_confirmation="请确认业务可接受的责任上限口径。",
                confidence=0.86,
            )
        )

    if any(term in text for term in RENEWAL_TERMS) and not any(
        term in text for term in RENEWAL_NOTICE_TERMS
    ):
        position = min(
            (text.find(term) for term in RENEWAL_TERMS if text.find(term) >= 0),
            default=0,
        )
        findings.append(
            FindingDraft(
                category="renewal",
                title="自动续期缺少明确提醒或退出机制",
                severity="medium",
                risk_type="renewal_notice_missing",
                risk_summary="合同存在自动续期或自动延长安排，但未识别到续期前提醒、书面通知或无成本退出机制。",
                source_quote=snippet_around(text, position, position + 4),
                source_start=position,
                source_end=position + 4,
                clause_index=find_clause_index(clauses, position),
                business_impact="可能在未完成预算或供应商评估时自动形成下一周期付款义务。",
                recommended_action="增加续期前书面提醒，并允许我方在合理期限内无额外费用退出。",
                suggested_replacement="任何自动续期应至少提前三十日书面提醒我方；我方可在续期日前书面通知不再续期，且无需承担额外费用。",
                fallback_position="如业务必须自动续期，至少保留明确提醒、价格确认和退出窗口。",
                required_confirmation="请确认业务是否接受自动续期以及所需提醒期限。",
                confidence=0.91,
            )
        )

    data_relevant = bool(context.get("involves_personal_information")) or any(
        term in text for term in PERSONAL_DATA_TERMS
    )
    if data_relevant:
        missing = [term for term in DATA_GUARD_TERMS if term not in text]
        if missing:
            position = min(
                (text.find(term) for term in PERSONAL_DATA_TERMS if text.find(term) >= 0),
                default=0,
            )
            findings.append(
                FindingDraft(
                    category="data_processing",
                    title="个人信息处理责任覆盖不完整",
                    severity="high",
                    risk_type="data_guard_missing",
                    risk_summary="根据合同内容或审查背景，本交易涉及个人信息，但未完整识别到以下保护机制：" + "、".join(missing) + "。",
                    source_quote=snippet_around(text, position, position + 4),
                    source_start=position,
                    source_end=position + 4,
                    clause_index=find_clause_index(clauses, position),
                    business_impact="数据泄露、违规分包或合同终止后未删除数据可能形成监管和客户投诉风险。",
                    recommended_action="补充处理目的、最小必要范围、安全措施、分包限制、事件通知以及删除返还义务。",
                    suggested_replacement="受托方仅可在履行本合同所必需的范围内处理个人信息，并采取适当安全措施；发生安全事件时应立即通知我方，未经书面同意不得分包，合同终止后应删除或返还相关数据。",
                    fallback_position="不能一次补齐全部机制时，安全事件通知、分包审批和终止后删除应作为最低要求。",
                    required_confirmation="请确认数据类型、存储地点、处理目的及是否存在第三方分包。",
                    confidence=0.9,
                )
            )

    return findings


def deduplicate_findings(findings: Iterable[FindingDraft]) -> list[FindingDraft]:
    seen: set[tuple[str, str, int | None, int | None]] = set()
    result: list[FindingDraft] = []
    for finding in findings:
        key = (
            finding.category,
            finding.risk_type,
            finding.source_start,
            finding.rule_id,
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(finding)
    return result
