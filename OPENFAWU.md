# openFaWu

openFaWu 是基于 OpenContracts 的**单人私有合同审查工作台**。产品主流程不是法律问答，也不是让法务手动操作 Agent，而是：

```text
上传合同
→ 确认合同类型、我方角色和交易背景
→ 识别合同条款
→ 执行确定性检查与 Playbook 对照
→ 生成逐条风险和替换文本
→ 人工接受、编辑、接受原文或待业务确认
→ 完成审查并导出交付物
```

OpenContracts 继续提供文档解析、原文存储、批注、版本、权限和异步任务能力；Playbook 是审查标准；本地 Codex 仅作为可选高级运行时，不再是日常产品入口。

## 当前实现

当前开发分支已经建立第一条可运行的合同审查纵向链路：

- 单人私有 Docker Compose 运行栈；
- 本地管理员和法务知识空间的一键初始化；
- `LegalWorkspace`、`ReviewProfile`、`PlaybookRule`、`ReviewRun`、`ContractClause`、`ContractFinding` 等领域模型；
- 合同审查状态机和人工复核状态；
- 默认中国大陆采购方 Playbook；
- PDF、DOCX、TXT 合同上传入口；
- 审查背景表单；
- 中文合同条款切分和稳定文本偏移；
- 确定性完整性、责任上限、自动续期和数据处理检查；
- Playbook 必备词、禁止词和适用条件检查；
- 合同审查列表、三栏复核工作台和规则查看页；
- 风险项的接受修改、编辑后接受、接受原文和待业务确认；
- 可选的宿主机 Codex App-Server 桥接器；
- 数据库备份和恢复脚本。

当前风险结果首先标记为“待确认”。后续会把文本偏移映射为 OpenContracts Annotation，并增加语义审查、DOCX 修改稿和审查报告导出。

## 本地启动

要求：Docker Desktop、Docker Compose、Python 3。

```bash
cp docs/sample_env_files/openfawu/solo.env.example .env.solo
make -f openfawu.mk solo-init
```

启动完成后访问：

```text
http://localhost:3000/reviews
```

登录信息保存在本机 `.env.solo`。

常用命令：

```bash
make -f openfawu.mk solo-up
make -f openfawu.mk solo-down
make -f openfawu.mk solo-logs
make -f openfawu.mk solo-backup
make -f openfawu.mk solo-restore FILE=backups/openfawu/<backup>.sql.gz
```

本地 Codex 是可选高级能力：

```bash
make -f openfawu.mk codex-init
make -f openfawu.mk codex-bridge
make -f openfawu.mk codex-token
```

高级页面位于 `http://localhost:3000/codex`，完整说明见 [`docs/legal-solo/local-codex.md`](docs/legal-solo/local-codex.md)。

## 产品边界

- RAG 只作为后台检索手段，不作为主交互。
- Codex 只作为后台执行或调试运行时，不作为合同审查入口。
- 法律依据、内部底线、商业偏好、历史经验和 Agent 推断必须分开表达。
- 所有风险、替换文本和最终交付物均需人工复核。
- 系统不得自动签署、发送、发布或向法院、监管机构提交材料。
- 默认仅用于本机私有部署，不应直接暴露到公网。

## 文档

- [合同审查工作流](docs/legal-solo/contract-review.md)
- [架构说明](docs/legal-solo/architecture.md)
- [本地 Codex 高级运行时](docs/legal-solo/local-codex.md)

## 上游与许可证

基座来自 [Open-Source-Legal/OpenContracts](https://github.com/Open-Source-Legal/OpenContracts)，精确提交记录在 `.openfawu/upstream.json`。OpenContracts 采用 MIT License；本仓库保留其许可证和归属信息。
