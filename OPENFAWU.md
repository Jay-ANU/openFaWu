# openFaWu

openFaWu 是基于 OpenContracts 的单人私有法务 Agent 工作台。当前仓库保留 OpenContracts 的文档解析、批注、引用、向量检索、Agent、GraphQL、WebSocket 和异步任务能力，在其上增加法务事项、合同审查规则、风险发现和法律研究领域层。

## 当前阶段

本次提交完成第一阶段基座：

- 固定并记录 OpenContracts 上游版本；
- 单人私有 Docker Compose 运行栈；
- 本地管理员和三个法务知识空间的一键初始化；
- `LegalWorkspace`、`ReviewProfile`、`PlaybookRule`、`ReviewRun`、`ContractFinding`、`ResearchRun` 领域模型；
- 合同审查状态机和证据核验状态；
- 默认中国大陆采购合同审查规则；
- 中文法务工作台及精简导航；
- 宿主机本地 Codex App-Server 桥接器、设备码登录和网页审批台；
- 数据库备份和恢复脚本。

合同自动分析与引用核验执行器将在下一阶段接入 OpenContracts 的 PydanticAI Agent API。当前版本已经建立稳定的数据契约，但不会伪装成已完成的自动合同审查产品。

## 本地启动

要求：Docker Desktop、Docker Compose、Python 3。

```bash
cp docs/sample_env_files/openfawu/solo.env.example .env.solo
# 密码和 Django Secret 可留空自动生成。OPENAI_API_KEY 仅供
# OpenContracts Agent/远程嵌入使用，本地 Codex 不依赖该变量。
make -f openfawu.mk solo-init
```

启动完成后访问 `http://localhost:3000`。登录信息保存在本机 `.env.solo`。

常用命令：

```bash
make -f openfawu.mk solo-up
make -f openfawu.mk solo-down
make -f openfawu.mk solo-logs
make -f openfawu.mk solo-backup
make -f openfawu.mk solo-restore FILE=backups/openfawu/<backup>.sql.gz

# 本地 Codex（另开终端）
make -f openfawu.mk codex-init
make -f openfawu.mk codex-bridge
make -f openfawu.mk codex-token
```

本地 Codex 页面位于 `http://localhost:3000/codex`。完整说明见 [`docs/legal-solo/local-codex.md`](docs/legal-solo/local-codex.md)。

## 安全边界

- 默认仅绑定本地开发端口，不应直接暴露到公网。Codex 桥接器强制绑定 loopback。
- 即使只有一个用户，仍保留登录、会话、CSRF 和对象权限。
- API Key 写入 OpenContracts 的加密 PipelineSettings；`.env.solo`、`.env.codex` 和 `.envs/.solo` 不应提交。
- Codex 桥接器不暴露原始 Shell，只允许配置根目录内的 read-only/workspace-write 会话，并保留逐项审批。
- Agent 输出必须由使用者人工审核，不能自动签署、发送或提交。
- 法律材料需要维护司法辖区、生效状态和核验日期，不能把未核验材料作为唯一结论依据。

## 上游与许可证

基座来自 [Open-Source-Legal/OpenContracts](https://github.com/Open-Source-Legal/OpenContracts)，精确提交记录在 `.openfawu/upstream.json`。OpenContracts 采用 MIT License；本仓库保留其许可证和归属信息。
