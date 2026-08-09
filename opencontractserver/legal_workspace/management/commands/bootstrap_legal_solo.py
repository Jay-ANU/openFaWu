from __future__ import annotations

import os
from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from opencontractserver.corpuses.models import Corpus
from opencontractserver.corpuses.services.corpus_service import CorpusService
from opencontractserver.documents.models import PipelineSettings
from opencontractserver.legal_workspace.enums import (
    MatterType,
    PartyPosition,
    RiskSeverity,
    WorkspaceType,
)
from opencontractserver.legal_workspace.models import (
    LegalWorkspace,
    PlaybookRule,
    ReviewProfile,
)

OPENAI_EMBEDDER_PATH = (
    "opencontractserver.pipeline.embedders.openai_embedder.OpenAIEmbedder"
)


@dataclass(frozen=True)
class WorkspaceSeed:
    title: str
    workspace_type: str
    description: str


WORKSPACE_SEEDS = (
    WorkspaceSeed(
        "法律法规库",
        WorkspaceType.AUTHORITY,
        "存放现行法律法规、司法解释、监管文件及其生效状态。",
    ),
    WorkspaceSeed(
        "法务审查规则库",
        WorkspaceType.PLAYBOOK,
        "存放合同审查规则、谈判底线、标准立场和备选条款。",
    ),
    WorkspaceSeed(
        "模板与范本库",
        WorkspaceType.TEMPLATE,
        "存放标准合同、法律意见书和常用法务文书模板。",
    ),
)

DEFAULT_RULES = (
    {
        "category": "liability",
        "title": "责任上限不得缺失或无限扩大",
        "severity": RiskSeverity.HIGH,
        "description": "识别无责任上限、间接损失全额承担或责任范围明显失衡的约定。",
        "prohibited_terms": ["一切损失", "全部损失", "无限责任"],
        "standard_position": "累计责任原则上不超过合同已付或应付总金额。",
        "fallback_position": "对保密、知识产权和故意或重大过失可设置有限例外。",
        "suggested_language": "除法律另有强制规定外，任一方累计赔偿责任以本合同项下已支付或应支付的合同价款为上限。",
        "business_question": "请确认业务可接受的责任上限及例外范围。",
        "blocking": True,
        "sort_order": 10,
    },
    {
        "category": "payment",
        "title": "付款应与交付、验收及发票挂钩",
        "severity": RiskSeverity.MEDIUM,
        "description": "识别大额预付款、未约定验收即付款或付款条件不可操作的条款。",
        "required_terms": ["验收", "发票"],
        "standard_position": "付款节点应与可验证的交付、验收及合规发票绑定。",
        "business_question": "请确认付款比例、账期、验收负责人及发票类型。",
        "applicability": {"party_positions": ["buyer"]},
        "sort_order": 20,
    },
    {
        "category": "acceptance",
        "title": "合同应提供可执行的验收机制",
        "severity": RiskSeverity.MEDIUM,
        "description": "识别只有交付义务但缺少验收标准、期限或不通过处理机制的合同。",
        "required_terms": ["验收"],
        "standard_position": "明确验收材料、客观标准、验收期限以及整改和复验机制。",
        "suggested_language": "乙方完成交付后应提交验收材料，甲方按照双方确认的验收标准进行验收；未通过验收的，乙方应在指定期限内免费整改并重新提交。",
        "business_question": "请确认能够客观验证的交付物与验收标准。",
        "applicability": {"party_positions": ["buyer"]},
        "sort_order": 30,
    },
    {
        "category": "intellectual_property",
        "title": "核心成果必须明确知识产权归属",
        "severity": RiskSeverity.HIGH,
        "description": "涉及定制开发、内容创作或核心成果时，应明确既有知识产权和新增成果归属。",
        "required_terms": ["知识产权"],
        "standard_position": "区分背景知识产权与项目成果，并保证我方取得实现交易目的所需的完整权利。",
        "fallback_position": "供应方保留背景技术时，应向我方授予永久、不可撤销且覆盖必要场景的许可。",
        "business_question": "请确认交易是否包含定制成果、源代码、数据集或品牌素材。",
        "applicability": {"requires_any_context_true": ["core_intellectual_property"]},
        "blocking": True,
        "sort_order": 40,
    },
    {
        "category": "confidentiality",
        "title": "保密义务应覆盖范围、例外与持续期限",
        "severity": RiskSeverity.MEDIUM,
        "description": "识别完全缺少保密安排，或保密范围、例外、返还销毁和持续期限不清的合同。",
        "required_terms": ["保密"],
        "standard_position": "明确保密信息范围、法定例外、最低保护措施、允许披露对象及合同终止后的持续义务。",
        "suggested_language": "接收方仅可为履行本合同之目的使用保密信息，并采取不低于保护自身同类信息的合理措施；合同终止不影响保密义务继续有效。",
        "business_question": "请确认是否会交换商业秘密、客户信息、源代码或未公开经营数据。",
        "sort_order": 50,
    },
    {
        "category": "data_processing",
        "title": "涉及个人信息时必须明确数据处理责任",
        "severity": RiskSeverity.HIGH,
        "description": "识别处理个人信息但缺少处理目的、范围、安全措施、分包和事件通知的合同。",
        "required_terms": ["安全事件", "分包", "删除"],
        "standard_position": "明确处理目的、最小必要范围、安全义务、分包限制、删除返还和事件通知。",
        "suggested_language": "受托方仅可在履行本合同所必需的范围内处理个人信息，未经书面同意不得分包；发生安全事件时应立即通知我方，合同终止后应删除或返还相关数据。",
        "business_question": "请确认数据类型、处理目的、存储地点、保留期限和第三方分包情况。",
        "applicability": {
            "requires_any_context_true": ["involves_personal_information", "cross_border_data"],
        },
        "blocking": True,
        "sort_order": 60,
    },
    {
        "category": "termination",
        "title": "合同应明确解除权及终止后处理",
        "severity": RiskSeverity.MEDIUM,
        "description": "识别缺少重大违约解除权、便利解除安排或终止后数据与费用处理机制的合同。",
        "required_terms": ["解除"],
        "standard_position": "至少保留重大违约解除权，并明确费用结算、资料返还、数据删除和持续义务。",
        "business_question": "请确认业务是否需要便利解除权及最短退出周期。",
        "sort_order": 70,
    },
    {
        "category": "renewal",
        "title": "自动续期必须提供明确提醒和退出机制",
        "severity": RiskSeverity.MEDIUM,
        "description": "识别默认自动续期、过短取消窗口或续期价格不明确的条款。",
        "prohibited_terms": ["自动续期且不得取消"],
        "standard_position": "续期前提供合理期限的书面提醒，并允许我方无额外费用退出。",
        "suggested_language": "任何自动续期应至少提前三十日书面提醒我方，我方可在续期日前书面通知不再续期且无需承担额外费用。",
        "business_question": "请确认是否接受自动续期及所需提醒期限。",
        "applicability": {"document_contains_any": ["自动续期", "自动续展", "自动延长"]},
        "sort_order": 80,
    },
    {
        "category": "dispute",
        "title": "争议解决机制必须明确且不得明显不利",
        "severity": RiskSeverity.MEDIUM,
        "description": "识别未约定争议解决、境外法、远地法院或不明确仲裁机构造成的执行成本。",
        "required_terms": ["仲裁", "法院"],
        "required_terms_mode": "any",
        "prohibited_terms": ["纽约州法律", "特拉华州法律", "境外法院", "外国法院"],
        "standard_position": "优先采用中国大陆法律及我方所在地法院或双方认可的仲裁机构。",
        "business_question": "请确认可接受的适用法律、法院或仲裁地。",
        "sort_order": 90,
    },
)


class Command(BaseCommand):
    help = "初始化 openFaWu 单人账户、知识空间、审查规则和模型配置。"

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--username", default=os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
        )
        parser.add_argument(
            "--email",
            default=os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@openfawu.local"),
        )
        parser.add_argument(
            "--password", default=os.getenv("DJANGO_SUPERUSER_PASSWORD", "")
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="已有账户也重新设置密码。",
        )
        parser.add_argument(
            "--skip-pipeline",
            action="store_true",
            help="不写入 OpenAI LLM/Embedding 配置。",
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        username = options["username"].strip()
        email = options["email"].strip()
        password = options["password"]
        if not username:
            raise CommandError("username 不能为空")
        if not password:
            raise CommandError(
                "请通过 DJANGO_SUPERUSER_PASSWORD 或 --password 提供本地登录密码。"
            )

        user_model = get_user_model()
        user = user_model.objects.filter(username=username).first()
        created = user is None
        if user is None:
            user = user_model.objects.create_superuser(
                username=username,
                email=email,
                password=password,
            )
        else:
            changed = False
            if not user.is_staff or not user.is_superuser:
                user.is_staff = True
                user.is_superuser = True
                changed = True
            if email and user.email != email:
                user.email = email
                changed = True
            if options["reset_password"]:
                user.set_password(password)
                changed = True
            if changed:
                user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"{'创建' if created else '复用'}单人管理员账户：{username}"
            )
        )

        for seed in WORKSPACE_SEEDS:
            corpus = Corpus.objects.filter(creator=user, title=seed.title).first()
            if corpus is None:
                corpus = Corpus.objects.create(
                    creator=user,
                    title=seed.title,
                    description=seed.description,
                    is_public=False,
                    allow_comments=False,
                    auto_branding_enabled=False,
                    memory_enabled=False,
                )
                CorpusService.grant_creator_permissions(user, corpus)
            LegalWorkspace.objects.update_or_create(
                corpus=corpus,
                defaults={
                    "owner": user,
                    "workspace_type": seed.workspace_type,
                    "matter_type": MatterType.GENERAL,
                    "jurisdiction": "CN-MAINLAND",
                },
            )
            self.stdout.write(f"  - 已就绪：{seed.title}")

        profile, _ = ReviewProfile.objects.update_or_create(
            owner=user,
            name="中国大陆通用采购合同审查",
            version=1,
            defaults={
                "contract_type": "采购合同",
                "party_position": PartyPosition.BUYER,
                "jurisdiction": "CN-MAINLAND",
                "description": "openFaWu 首版默认采购方合同审查规则。",
                "enabled": True,
            },
        )
        for rule_data in DEFAULT_RULES:
            title = rule_data["title"]
            PlaybookRule.objects.update_or_create(
                review_profile=profile,
                title=title,
                defaults=rule_data,
            )
        self.stdout.write(
            self.style.SUCCESS(f"默认审查规则已就绪：{profile.rules.count()} 条")
        )

        if not options["skip_pipeline"]:
            self._configure_pipeline(user)

        self.stdout.write(self.style.SUCCESS("openFaWu 单人模式初始化完成。"))

    def _configure_pipeline(self, user) -> None:
        pipeline = PipelineSettings.get_instance(use_cache=False)
        pipeline.default_embedder = OPENAI_EMBEDDER_PATH
        model = os.getenv("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o"
        pipeline.default_llm = model if ":" in model else f"openai:{model}"
        pipeline.modified_by = user

        component_settings = dict(pipeline.component_settings or {})
        embedder_settings = dict(component_settings.get(OPENAI_EMBEDDER_PATH) or {})
        embedder_settings.setdefault(
            "openai_embedding_model",
            os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        )
        embedder_settings.setdefault(
            "openai_embedding_dimensions",
            int(os.getenv("OPENAI_EMBEDDING_DIMENSIONS", "384")),
        )
        api_base = os.getenv("OPENAI_API_BASE_URL", "").strip()
        if api_base:
            embedder_settings["openai_api_base_url"] = api_base
        component_settings[OPENAI_EMBEDDER_PATH] = embedder_settings
        pipeline.component_settings = component_settings

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if api_key and not api_key.startswith("<") and "your" not in api_key.lower():
            secrets = dict(pipeline.get_secrets() or {})
            embedder_secrets = dict(secrets.get(OPENAI_EMBEDDER_PATH) or {})
            embedder_secrets["openai_api_key"] = api_key
            secrets[OPENAI_EMBEDDER_PATH] = embedder_secrets
            pipeline.set_secrets(secrets)
        else:
            self.stdout.write(
                self.style.WARNING(
                    "未检测到有效 OPENAI_API_KEY；界面与 Local Codex 可用，但 OpenContracts 内置 Agent 和远程嵌入不会工作。"
                )
            )
        pipeline.save()
        self.stdout.write(
            self.style.SUCCESS(
                f"Pipeline 已设置：{pipeline.default_llm} / OpenAI Embedder"
            )
        )
