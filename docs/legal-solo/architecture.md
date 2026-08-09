# openFaWu 单人法务架构

## 1. 设计原则

openFaWu 不复制一套文档系统。OpenContracts 的 `Corpus` 继续承担文档集合、权限、搜索、批注、引用关系、会话和 Agent 上下文；`LegalWorkspace` 只为 Corpus 增加法务语义。

```text
LegalWorkspace
└── Corpus (OpenContracts)
    ├── Document
    ├── Annotation
    ├── Relationship
    ├── Conversation
    ├── Extract
    └── AgentConfiguration
```

这种适配层避免修改 OpenContracts 的核心模型，使后续同步上游修复仍然可控。

## 2. 工作区类型

- `matter`：合同、劳动、合规或争议事项；
- `authority`：法律法规和监管材料；
- `playbook`：合同审查标准和谈判底线；
- `template`：标准合同及法务文书模板。

只有 `matter` 可以创建 `ReviewRun` 和 `ResearchRun`。

## 3. 合同审查数据链路

```text
ReviewProfile
└── PlaybookRule[]

ReviewRun
├── LegalWorkspace(matter)
├── Document
├── ReviewProfile(versioned)
├── extracted_contract_data
└── ContractFinding[]
    ├── source_annotation
    ├── source_quote
    ├── playbook_rule
    ├── legal_basis_annotations[]
    ├── verification_status
    └── review_status
```

`ContractFinding` 不能只保存模型结论。合同原文、规则和法律依据分别建模，允许独立核验与人工复核。

## 4. 审查状态机

```text
pending
  → waiting_for_document | parsing
  → extracting
  → matching_rules
  → analyzing
  → verifying
  → ready_for_review
  → completed
```

任意执行阶段可进入 `failed` 或 `cancelled`。失败及取消任务可以显式重置到 `pending`，其他跨阶段跳转会被模型拒绝。

## 5. 单人运行栈

默认 Compose 只启动：

- Django / Daphne
- PostgreSQL + pgvector
- Redis
- Celery Worker
- Docling PDF Parser
- Docxodus DOCX Parser
- React/Vite Frontend

本地向量、多模态、社区排行、定时抓取、Flower、Gotenberg 和第二套 PDF 解析器均不默认常驻。Embedding 默认使用现有 `OpenAIEmbedder`，因此不需要额外向量微服务。

## 6. 下一阶段

下一阶段按以下顺序实现：

1. 合同事实与条款 Pydantic Schema；
2. Playbook 规则检索器；
3. 基于 OpenContracts Document Agent 的结构化抽取；
4. EvidenceValidator：逐项验证 quote、annotation、页码、规则版本和法律状态；
5. Celery 幂等执行和重试；
6. 三栏合同审查工作台；
7. Markdown/DOCX 审查报告导出。

首个可用闭环的验收条件是：上传合同后生成风险清单，每个风险都能定位到原文，且用户可以接受、编辑、驳回并导出结果。
