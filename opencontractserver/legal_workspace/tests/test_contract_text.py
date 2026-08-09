from __future__ import annotations

import unittest

from opencontractserver.legal_workspace.services.contract_text import (
    RuleSpec,
    deduplicate_findings,
    evaluate_generic_checks,
    evaluate_playbook_rules,
    parse_contract_clauses,
)


SAMPLE_CONTRACT = """采购服务合同
甲方：示例科技有限公司
乙方：供应商有限公司

第一条 服务内容
乙方向甲方提供软件服务，具体范围以附件为准。

第二条 付款与验收
甲方应在收到合规发票后付款。

第三条 违约责任
乙方应赔偿甲方因此遭受的一切损失。

第四条 合同期限
本合同到期后自动续期一年。
"""


class ContractTextTest(unittest.TestCase):
    def test_parse_chinese_articles_with_offsets(self) -> None:
        clauses = parse_contract_clauses(SAMPLE_CONTRACT)
        self.assertGreaterEqual(len(clauses), 5)
        liability = next(c for c in clauses if c.clause_type == "liability")
        self.assertIn("一切损失", liability.text)
        self.assertEqual(
            SAMPLE_CONTRACT[liability.source_start : liability.source_end],
            liability.text,
        )

    def test_playbook_rule_flags_prohibited_term(self) -> None:
        clauses = parse_contract_clauses(SAMPLE_CONTRACT)
        rule = RuleSpec(
            rule_id=1,
            category="liability",
            title="责任范围不得无限扩大",
            severity="high",
            description="限制无限责任。",
            required_terms=(),
            prohibited_terms=("一切损失",),
            required_terms_mode="all",
            standard_position="责任应有明确上限。",
            fallback_position="特定事项可设置有限例外。",
            suggested_language="累计责任不超过合同金额。",
            business_question="确认可接受上限。",
            applicability={},
            blocking=False,
        )
        findings = evaluate_playbook_rules(
            SAMPLE_CONTRACT,
            clauses,
            [rule],
            {"contract_type": "采购合同", "party_position": "buyer"},
        )
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].risk_type, "prohibited_term")
        self.assertIsNotNone(findings[0].clause_index)

    def test_generic_checks_find_missing_cap_and_renewal_notice(self) -> None:
        clauses = parse_contract_clauses(SAMPLE_CONTRACT)
        findings = evaluate_generic_checks(SAMPLE_CONTRACT, clauses, {})
        kinds = {finding.risk_type for finding in findings}
        self.assertIn("missing_liability_cap", kinds)
        self.assertIn("renewal_notice_missing", kinds)

    def test_data_rule_only_applies_when_context_or_text_requires_it(self) -> None:
        clauses = parse_contract_clauses("第一条 服务内容\n提供普通设备维护服务。")
        rule = RuleSpec(
            rule_id=2,
            category="data_processing",
            title="个人信息处理责任",
            severity="high",
            description="补齐数据保护机制。",
            required_terms=("安全事件", "分包"),
            prohibited_terms=(),
            required_terms_mode="all",
            standard_position="明确数据处理义务。",
            fallback_position="",
            suggested_language="",
            business_question="",
            applicability={"requires_any_context_true": ["involves_personal_information"]},
            blocking=False,
        )
        self.assertEqual(
            evaluate_playbook_rules(
                "第一条 服务内容\n提供普通设备维护服务。",
                clauses,
                [rule],
                {"involves_personal_information": False},
            ),
            [],
        )
        self.assertEqual(
            len(
                evaluate_playbook_rules(
                    "第一条 服务内容\n提供普通设备维护服务。",
                    clauses,
                    [rule],
                    {"involves_personal_information": True},
                )
            ),
            1,
        )

    def test_deduplicate_findings(self) -> None:
        clauses = parse_contract_clauses(SAMPLE_CONTRACT)
        findings = evaluate_generic_checks(SAMPLE_CONTRACT, clauses, {})
        combined = deduplicate_findings([*findings, *findings])
        self.assertEqual(len(combined), len(findings))


if __name__ == "__main__":
    unittest.main()
