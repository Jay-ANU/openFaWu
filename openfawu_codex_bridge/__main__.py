from __future__ import annotations

import argparse
import sys

from openfawu_codex_bridge.config import BridgeConfig, ConfigurationError
from openfawu_codex_bridge.http_api import serve


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the loopback-only openFaWu bridge for local Codex app-server."
    )
    parser.add_argument("--host")
    parser.add_argument("--port", type=int)
    parser.add_argument("--token")
    parser.add_argument("--codex-bin")
    parser.add_argument(
        "--allowed-roots",
        help="Allowed workspace roots separated by the operating system path separator.",
    )
    parser.add_argument(
        "--allowed-origins", help="Comma-separated browser origins allowed by CORS."
    )
    parser.add_argument(
        "--allow-no-approval",
        action="store_true",
        help="Permit approvalPolicy=never. Disabled by default.",
    )
    return parser


def main() -> int:
    try:
        config = BridgeConfig.from_args(build_parser().parse_args())
        serve(config)
        return 0
    except ConfigurationError as exc:
        print(f"配置错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
