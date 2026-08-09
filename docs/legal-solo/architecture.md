# openFaWu 单人合同审查架构

## 1. 产品与底座分层

openFaWu 不复制一套文档系统，也不把 OpenContracts 的 RAG 问答直接当作产品。各层职责如下：

```text
合同审查工作台
├── 上传与审查背景
├── 条款目录
├── 风险与修改意见
├── 人工复核
└── 审查交付物
        ↓
合同审查领域层
├── ReviewProfile / PlaybookRule
├── ReviewRun 状态机
├── ContractClause
├── ContractFinding
└── 审查引擎
        ↓
OpenContracts 底座
├── Document 与解析管线
├── Annotation 与版本
├── Corpus 与权限
├── Celery
└── GraphQL / REST
```

RAG 退到后台检索层，本地 Codex 退到可选执行层。用户的默认入口始终是合同审查。

## 2. 工作区类型

- `matter`：合同审查事项；
- `authority`：法律法规和监管材料；
- `playbook`：合同审查标准和谈判底线；
- `template`：标准合同及法务文书模板。

当前主流程只使用 `matter`、`playbook` 和 `template`。

## 3. 合同审查数据链路

```text
ReviewProfile
└── PlaybookRule[]

ReviewRun
├── LegalWorkspace(matter)
├── Document
├── ReviewProfile(versioned)
├── input_context
├── extracted_contract_data
├── ContractClause[]
└── ContractFinding[]
    ├── clause / source offsets
    ├── playbook_rule + rule_snapshot
    ├── source_quote
    ├── standard position
    ├── suggested replacement
    ├── fallback position
    ├── required confirmation
    ├── verification_status
    └── review_status
```

风险结论不能脱离原合同条款，也不能把内部谈判偏好表述成法律强制要求。

## 4. 审查执行

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

当前引擎由两部分组成：

1. 文本与规则确定性层：条款切分、完整性、关键表述和 Playbook 检查；
2. 未来语义层：跨条款冲突、实质偏离和替换文本优化。

语义层只能追加或补充风险，不能静默删除确定性结果。

## 5. 单人运行栈

默认 Compose 只启动：

- Django / Daphne；
- PostgreSQL + pgvector；
- Redis；
- Celery Worker；
- Docling PDF Parser；
- Docxodus DOCX Parser；
- React/Vite Frontend。

本地向量、多模态、社区排行、定时抓取、Flower、Gotenberg 和第二套 PDF 解析器均不默认常驻。

## 6. 本地 Codex

Codex Bridge 保留，但只作为高级运行时，用于后续：

- 生成 DOCX 修改稿；
- 执行文档校验脚本；
- 生成审查报告；
- 批量处理本地合同文件；
- 调试语义审查流程。

它不出现在一级导航中，也不要求用户为每份合同手动创建 Codex 线程。

## 7. 下一阶段

1. 将文本偏移转成 OpenContracts Annotation；
2. 接入语义风险分析并保持结构化输出；
3. 增加 Playbook 编辑器和版本发布；
4. 生成 DOCX 修改建议表与审查报告；
5. 生成修改后合同，并在条件允许时支持 Track Changes；
6. 建立合同回归集，度量高风险召回率、误报率和人工修改率。
