from __future__ import annotations

import argparse
import tempfile
import unittest
from pathlib import Path

from openfawu_codex_bridge.config import BridgeConfig, ConfigurationError


class BridgeConfigTest(unittest.TestCase):
    def make_args(self, root: str, **overrides):
        values = {
            "host": "127.0.0.1",
            "port": 8765,
            "token": "x" * 32,
            "codex_bin": "codex",
            "allowed_roots": root,
            "allowed_origins": "http://localhost:3000",
            "allow_no_approval": False,
        }
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_rejects_non_loopback_binding(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ConfigurationError):
                BridgeConfig.from_args(self.make_args(root, host="0.0.0.0"))

    def test_workspace_must_stay_inside_allowed_root(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as other:
            config = BridgeConfig.from_args(self.make_args(root))
            allowed = Path(root) / "matter-a"
            allowed.mkdir()
            self.assertEqual(config.validate_workspace(str(allowed)), allowed.resolve())
            with self.assertRaises(ConfigurationError):
                config.validate_workspace(other)

    def test_rejects_short_token(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ConfigurationError):
                BridgeConfig.from_args(self.make_args(root, token="short"))


if __name__ == "__main__":
    unittest.main()
