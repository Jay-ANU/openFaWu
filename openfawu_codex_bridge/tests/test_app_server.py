from __future__ import annotations

import os
import stat
import tempfile
import time
import unittest
from pathlib import Path

from openfawu_codex_bridge.app_server import CodexAppServerClient
from openfawu_codex_bridge.config import BridgeConfig
from openfawu_codex_bridge.events import EventStore


FAKE_CODEX = r'''#!/usr/bin/env python3
import json
import sys

if len(sys.argv) > 1 and sys.argv[1] == "--version":
    print("codex-cli fake-1.0")
    raise SystemExit(0)

for line in sys.stdin:
    if not line.strip():
        continue
    msg = json.loads(line)
    method = msg.get("method")
    request_id = msg.get("id")
    if method == "initialize":
        print(json.dumps({"id": request_id, "result": {"codexHome": "/tmp/fake-codex"}}), flush=True)
    elif method == "initialized":
        continue
    elif method == "account/read":
        print(json.dumps({"id": request_id, "result": {"account": {"email": "local@example.com"}}}), flush=True)
    elif method == "thread/start":
        print(json.dumps({"id": request_id, "result": {"thread": {"id": "thr_fake"}}}), flush=True)
        print(json.dumps({"method": "thread/started", "params": {"thread": {"id": "thr_fake"}}}), flush=True)
    elif method == "turn/start":
        print(json.dumps({"id": request_id, "result": {"turn": {"id": "turn_fake", "status": "inProgress"}}}), flush=True)
        print(json.dumps({"method": "turn/started", "params": {"threadId": "thr_fake", "turn": {"id": "turn_fake"}}}), flush=True)
        print(json.dumps({
            "id": "approval-1",
            "method": "item/commandExecution/requestApproval",
            "params": {
                "threadId": "thr_fake",
                "turnId": "turn_fake",
                "itemId": "cmd_1",
                "command": "echo safe",
                "cwd": "/tmp"
            }
        }), flush=True)
    elif request_id == "approval-1":
        print(json.dumps({"method": "item/agentMessage/delta", "params": {
            "threadId": "thr_fake", "turnId": "turn_fake", "itemId": "msg_1", "delta": "done"
        }}), flush=True)
        print(json.dumps({"method": "turn/completed", "params": {
            "threadId": "thr_fake", "turn": {"id": "turn_fake", "status": "completed"}
        }}), flush=True)
'''


class CodexAppServerClientTest(unittest.TestCase):
    def test_lifecycle_and_approval(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            executable = root / "codex-fake"
            executable.write_text(FAKE_CODEX, encoding="utf-8")
            executable.chmod(executable.stat().st_mode | stat.S_IXUSR)

            config = BridgeConfig(
                host="127.0.0.1",
                port=8765,
                token="abcdefghijklmnopqrstuvwxyz123456",
                codex_bin=str(executable),
                allowed_roots=(root,),
                allowed_origins=("http://localhost:3000",),
                rpc_timeout_seconds=3,
            )
            events = EventStore()
            client = CodexAppServerClient(config, events)
            try:
                init = client.ensure_started()
                self.assertEqual(init["codexHome"], "/tmp/fake-codex")
                self.assertTrue(client.process_running)
                self.assertIn("fake-1.0", client.codex_version() or "")

                account = client.request("account/read", {"refreshToken": False})
                self.assertEqual(account["account"]["email"], "local@example.com")

                started = client.request(
                    "thread/start",
                    {
                        "cwd": str(root),
                        "sandbox": "read-only",
                        "approvalPolicy": "on-request",
                    },
                )
                self.assertEqual(started["thread"]["id"], "thr_fake")

                turn = client.request(
                    "turn/start",
                    {
                        "threadId": "thr_fake",
                        "input": [{"type": "text", "text": "test"}],
                    },
                )
                self.assertEqual(turn["turn"]["id"], "turn_fake")

                deadline = time.monotonic() + 2
                pending = []
                while time.monotonic() < deadline:
                    pending = client.pending_requests()
                    if pending:
                        break
                    time.sleep(0.02)
                self.assertEqual(len(pending), 1)
                self.assertEqual(pending[0]["params"]["command"], "echo safe")

                client.resolve_approval(pending[0]["requestKey"], "accept")
                deadline = time.monotonic() + 2
                observed = []
                while time.monotonic() < deadline:
                    observed = events.read(after=0)["events"]
                    if any(item["method"] == "turn/completed" for item in observed):
                        break
                    time.sleep(0.02)
                self.assertTrue(
                    any(item["method"] == "item/agentMessage/delta" for item in observed)
                )
                self.assertEqual(client.pending_request_count(), 0)
            finally:
                client.stop()

    def test_stop_clears_pending_approval(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            executable = root / "codex-fake"
            executable.write_text(FAKE_CODEX, encoding="utf-8")
            executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
            config = BridgeConfig(
                host="127.0.0.1",
                port=8765,
                token="abcdefghijklmnopqrstuvwxyz123456",
                codex_bin=str(executable),
                allowed_roots=(root,),
                allowed_origins=("http://localhost:3000",),
                rpc_timeout_seconds=3,
            )
            events = EventStore()
            client = CodexAppServerClient(config, events)
            client.ensure_started()
            client.request(
                "turn/start",
                {
                    "threadId": "thr_fake",
                    "input": [{"type": "text", "text": "test"}],
                },
            )
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline and not client.pending_requests():
                time.sleep(0.02)
            self.assertEqual(client.pending_request_count(), 1)
            client.stop()
            self.assertEqual(client.pending_request_count(), 0)
            methods = [item["method"] for item in events.read(after=0)["events"]]
            self.assertIn("bridge/approvalExpired", methods)


if __name__ == "__main__":
    unittest.main()
