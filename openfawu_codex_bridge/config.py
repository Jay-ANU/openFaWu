from __future__ import annotations

import argparse
import ipaddress
import os
import secrets
import shutil
from dataclasses import dataclass, field
from pathlib import Path


class ConfigurationError(ValueError):
    """Raised when bridge configuration is unsafe or invalid."""


def _split_paths(raw: str) -> tuple[Path, ...]:
    values = [part.strip() for part in raw.split(os.pathsep) if part.strip()]
    return tuple(Path(value).expanduser().resolve() for value in values)


def _split_csv(raw: str) -> tuple[str, ...]:
    return tuple(value.strip().rstrip("/") for value in raw.split(",") if value.strip())


def _is_loopback_host(host: str) -> bool:
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


@dataclass(frozen=True)
class BridgeConfig:
    host: str
    port: int
    token: str
    codex_bin: str
    allowed_roots: tuple[Path, ...]
    allowed_origins: tuple[str, ...]
    max_prompt_chars: int = 200_000
    max_body_bytes: int = 1_048_576
    event_capacity: int = 4_000
    rpc_timeout_seconds: float = 45.0
    allow_no_approval: bool = False
    generated_token: bool = field(default=False, init=False, repr=False)

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> "BridgeConfig":
        host = args.host or os.getenv("OPENFAWU_CODEX_BRIDGE_HOST", "127.0.0.1")
        if not _is_loopback_host(host):
            raise ConfigurationError(
                "Codex bridge 只允许绑定 localhost/loopback；请勿将本机 Codex 暴露到局域网或公网。"
            )

        port = int(args.port or os.getenv("OPENFAWU_CODEX_BRIDGE_PORT", "8765"))
        if not 1 <= port <= 65535:
            raise ConfigurationError("端口必须在 1 到 65535 之间。")

        token = args.token or os.getenv("OPENFAWU_CODEX_BRIDGE_TOKEN", "")
        generated = False
        if not token:
            token = secrets.token_urlsafe(32)
            generated = True
        if len(token) < 24:
            raise ConfigurationError("桥接器 Token 至少需要 24 个字符。")

        default_workspace = Path.home() / ".openfawu" / "workspaces"
        roots_raw = args.allowed_roots or os.getenv(
            "OPENFAWU_CODEX_ALLOWED_ROOTS", str(default_workspace)
        )
        allowed_roots = _split_paths(roots_raw)
        if not allowed_roots:
            raise ConfigurationError("至少需要配置一个允许的工作目录根路径。")
        for root in allowed_roots:
            root.mkdir(parents=True, exist_ok=True)
            if not root.is_dir():
                raise ConfigurationError(f"允许根路径不是目录：{root}")
            if root == Path(root.anchor):
                raise ConfigurationError("不允许把整个磁盘根目录配置为 Codex 工作区。")

        origins_raw = args.allowed_origins or os.getenv(
            "OPENFAWU_CODEX_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
        allowed_origins = _split_csv(origins_raw)
        if not allowed_origins:
            raise ConfigurationError("至少需要配置一个允许的网页 Origin。")
        if "*" in allowed_origins:
            raise ConfigurationError("不允许使用通配符 CORS Origin。")

        codex_bin = args.codex_bin or os.getenv("OPENFAWU_CODEX_BIN", "codex")
        resolved_codex = shutil.which(codex_bin)
        # The HTTP bridge is allowed to start before Codex is installed so the
        # UI can display an actionable diagnostic. Preserve the configured
        # command when it cannot be resolved yet.
        codex_bin = resolved_codex or codex_bin

        allow_no_approval = (
            args.allow_no_approval
            or os.getenv("OPENFAWU_CODEX_ALLOW_NO_APPROVAL", "").lower()
            in {"1", "true", "yes"}
        )

        config = cls(
            host=host,
            port=port,
            token=token,
            codex_bin=codex_bin,
            allowed_roots=allowed_roots,
            allowed_origins=allowed_origins,
            max_prompt_chars=int(
                os.getenv("OPENFAWU_CODEX_MAX_PROMPT_CHARS", "200000")
            ),
            max_body_bytes=int(
                os.getenv("OPENFAWU_CODEX_MAX_BODY_BYTES", "1048576")
            ),
            event_capacity=int(
                os.getenv("OPENFAWU_CODEX_EVENT_CAPACITY", "4000")
            ),
            rpc_timeout_seconds=float(
                os.getenv("OPENFAWU_CODEX_RPC_TIMEOUT_SECONDS", "45")
            ),
            allow_no_approval=allow_no_approval,
        )
        object.__setattr__(config, "generated_token", generated)
        return config

    def validate_workspace(self, candidate: str) -> Path:
        if not candidate or not candidate.strip():
            raise ConfigurationError("工作目录不能为空。")
        path = Path(candidate).expanduser().resolve()
        if not path.exists():
            raise ConfigurationError(f"工作目录不存在：{path}")
        if not path.is_dir():
            raise ConfigurationError(f"工作目录不是文件夹：{path}")

        for root in self.allowed_roots:
            try:
                path.relative_to(root)
                return path
            except ValueError:
                continue
        roots = "、".join(str(root) for root in self.allowed_roots)
        raise ConfigurationError(f"工作目录不在允许范围内。允许根路径：{roots}")
