from __future__ import annotations

import json
import os
import queue
import shutil
import signal
import subprocess
import threading
import uuid
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openfawu_codex_bridge import __version__
from openfawu_codex_bridge.config import BridgeConfig, ConfigurationError
from openfawu_codex_bridge.events import EventStore


class CodexBridgeError(RuntimeError):
    """Base error returned to the HTTP layer."""


class CodexUnavailableError(CodexBridgeError):
    pass


class CodexRpcError(CodexBridgeError):
    def __init__(self, method: str, error: Any) -> None:
        self.method = method
        self.error = error
        super().__init__(f"Codex RPC {method} 失败：{error}")


@dataclass
class PendingServerRequest:
    raw_id: str | int
    method: str
    params: dict[str, Any]


class CodexAppServerClient:
    """Small, version-tolerant client for ``codex app-server`` over stdio."""

    APPROVAL_METHODS = {
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
    }
    APPROVAL_DECISIONS = {"accept", "acceptForSession", "decline", "cancel"}

    def __init__(self, config: BridgeConfig, events: EventStore) -> None:
        self.config = config
        self.events = events
        self._process: subprocess.Popen[str] | None = None
        self._process_lock = threading.RLock()
        self._write_lock = threading.Lock()
        self._request_id = 1
        self._pending: dict[int, queue.Queue[dict[str, Any]]] = {}
        self._pending_lock = threading.Lock()
        self._server_requests: dict[str, PendingServerRequest] = {}
        self._server_requests_lock = threading.Lock()
        self._stderr_tail: deque[str] = deque(maxlen=80)
        self._initialize_result: dict[str, Any] | None = None
        self._version: str | None = None

    @property
    def process_running(self) -> bool:
        process = self._process
        return bool(process and process.poll() is None)

    @property
    def pid(self) -> int | None:
        return self._process.pid if self.process_running and self._process else None

    def codex_available(self) -> bool:
        return bool(shutil.which(self.config.codex_bin) or Path(self.config.codex_bin).exists())

    def codex_version(self) -> str | None:
        if self._version:
            return self._version
        if not self.codex_available():
            return None
        try:
            result = subprocess.run(
                [self.config.codex_bin, "--version"],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        value = (result.stdout or result.stderr).strip()
        self._version = value or None
        return self._version

    def status(self) -> dict[str, Any]:
        return {
            "bridgeVersion": __version__,
            "codexAvailable": self.codex_available(),
            "codexCommand": self.config.codex_bin,
            "codexVersion": self.codex_version(),
            "appServerRunning": self.process_running,
            "appServerPid": self.pid,
            "initializeResult": self._initialize_result,
            "allowedRoots": [str(path) for path in self.config.allowed_roots],
            "allowedOrigins": list(self.config.allowed_origins),
            "pendingRequests": self.pending_request_count(),
            "latestEventSequence": self.events.latest_sequence(),
            "stderrTail": list(self._stderr_tail)[-20:],
            "security": {
                "loopbackOnly": True,
                "allowedSandboxes": ["read-only", "workspace-write"],
                "allowNoApproval": self.config.allow_no_approval,
                "directShellEndpoint": False,
            },
        }

    def ensure_started(self) -> dict[str, Any]:
        with self._process_lock:
            if self.process_running:
                return self._initialize_result or {}
            if not self.codex_available():
                raise CodexUnavailableError(
                    "未检测到 Codex CLI。请先执行 `npm install -g @openai/codex` "
                    "或 `brew install --cask codex`。"
                )
            self._spawn_locked()
            try:
                result = self._rpc_request_started(
                    "initialize",
                    {
                        "clientInfo": {
                            "name": "openfawu_local_bridge",
                            "title": "openFaWu Local Codex Bridge",
                            "version": __version__,
                        }
                    },
                    timeout=20,
                )
                self._write_message({"method": "initialized", "params": {}})
                self._initialize_result = result if isinstance(result, dict) else {}
                self.events.append(
                    kind="bridge",
                    method="bridge/connected",
                    params={"initializeResult": self._initialize_result},
                )
                return self._initialize_result
            except Exception:
                self.stop()
                raise

    def _spawn_locked(self) -> None:
        env = os.environ.copy()
        command = [self.config.codex_bin, "app-server"]
        try:
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=env,
                start_new_session=(os.name != "nt"),
            )
        except OSError as exc:
            raise CodexUnavailableError(f"无法启动 Codex app-server：{exc}") from exc
        self._process = process
        threading.Thread(
            target=self._stdout_loop,
            name="openfawu-codex-stdout",
            daemon=True,
        ).start()
        threading.Thread(
            target=self._stderr_loop,
            name="openfawu-codex-stderr",
            daemon=True,
        ).start()

    def stop(self) -> None:
        with self._process_lock:
            process = self._process
            self._process = None
            self._initialize_result = None
            if not process:
                return
            if process.poll() is None:
                try:
                    if os.name != "nt":
                        os.killpg(process.pid, signal.SIGTERM)
                    else:
                        process.terminate()
                    process.wait(timeout=5)
                except (OSError, subprocess.TimeoutExpired):
                    try:
                        if os.name != "nt":
                            os.killpg(process.pid, signal.SIGKILL)
                        else:
                            process.kill()
                    except OSError:
                        pass
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream is not None:
                    try:
                        stream.close()
                    except OSError:
                        pass
            self._fail_all_pending("Codex app-server 已停止。")
            self._clear_server_requests("Codex app-server 已停止。")
            self.events.append(kind="bridge", method="bridge/stopped", params={})

    def request(
        self,
        method: str,
        params: dict[str, Any] | None = None,
        *,
        timeout: float | None = None,
    ) -> Any:
        self.ensure_started()
        return self._rpc_request_started(method, params or {}, timeout=timeout)

    def _rpc_request_started(
        self,
        method: str,
        params: dict[str, Any],
        *,
        timeout: float | None = None,
    ) -> Any:
        with self._pending_lock:
            request_id = self._request_id
            self._request_id += 1
            response_queue: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=1)
            self._pending[request_id] = response_queue
        try:
            self._write_message({"method": method, "id": request_id, "params": params})
            try:
                response = response_queue.get(
                    timeout=timeout or self.config.rpc_timeout_seconds
                )
            except queue.Empty as exc:
                raise CodexBridgeError(f"Codex RPC {method} 等待响应超时。") from exc
        finally:
            with self._pending_lock:
                self._pending.pop(request_id, None)
        if "error" in response:
            raise CodexRpcError(method, response["error"])
        return response.get("result")

    def _write_message(self, payload: dict[str, Any]) -> None:
        process = self._process
        if not process or process.poll() is not None or not process.stdin:
            raise CodexBridgeError("Codex app-server 未运行。")
        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with self._write_lock:
            try:
                process.stdin.write(line + "\n")
                process.stdin.flush()
            except (BrokenPipeError, OSError) as exc:
                raise CodexBridgeError("Codex app-server 通道已断开。") from exc

    def _stdout_loop(self) -> None:
        process = self._process
        if not process or not process.stdout:
            return
        for raw_line in process.stdout:
            line = raw_line.strip()
            if not line:
                continue
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                self.events.append(
                    kind="bridge",
                    method="bridge/protocolWarning",
                    params={"message": "Codex 输出了非 JSON 消息。"},
                )
                continue
            if not isinstance(message, dict):
                continue
            self._handle_message(message)
        exit_code = process.poll()
        # Ignore the reader belonging to an older process after an explicit
        # restart. Without this identity check, a delayed EOF from the old
        # process could fail requests already issued to the new app-server.
        with self._process_lock:
            if self._process is not process:
                return
            self._process = None
            self._initialize_result = None
        message = f"Codex app-server 已退出，exitCode={exit_code}"
        self._fail_all_pending(message)
        self._clear_server_requests(message)
        self.events.append(
            kind="bridge",
            method="bridge/processExited",
            params={"exitCode": exit_code},
        )

    def _stderr_loop(self) -> None:
        process = self._process
        if not process or not process.stderr:
            return
        for raw_line in process.stderr:
            line = raw_line.rstrip()
            if not line:
                continue
            self._stderr_tail.append(line)
            self.events.append(
                kind="log",
                method="bridge/codexLog",
                params={"message": line[-4_000:]},
            )

    def _handle_message(self, message: dict[str, Any]) -> None:
        message_id = message.get("id")
        method = message.get("method")
        if message_id is not None and not method:
            if isinstance(message_id, int):
                with self._pending_lock:
                    response_queue = self._pending.get(message_id)
                if response_queue:
                    try:
                        response_queue.put_nowait(message)
                    except queue.Full:
                        pass
            return

        params = message.get("params")
        safe_params = params if isinstance(params, dict) else {}
        if method and message_id is not None:
            method_name = str(method)
            if method_name not in self.APPROVAL_METHODS:
                # Do not leave Codex blocked forever on a request the minimal
                # legal UI cannot safely answer yet (MCP elicitation, dynamic
                # tools, token refresh, etc.). Return an explicit protocol
                # error and surface the event for diagnostics.
                try:
                    self._write_message(
                        {
                            "id": message_id,
                            "error": {
                                "code": -32601,
                                "message": (
                                    "openFaWu bridge does not support this server request: "
                                    f"{method_name}"
                                ),
                            },
                        }
                    )
                finally:
                    self.events.append(
                        kind="bridge",
                        method="bridge/unsupportedServerRequest",
                        params={
                            "requestMethod": method_name,
                            "threadId": safe_params.get("threadId"),
                            "turnId": safe_params.get("turnId"),
                        },
                    )
                return
            request_key = uuid.uuid4().hex
            with self._server_requests_lock:
                self._server_requests[request_key] = PendingServerRequest(
                    raw_id=message_id,
                    method=method_name,
                    params=safe_params,
                )
            self.events.append(
                kind="request",
                method=method_name,
                params=safe_params,
                request_key=request_key,
            )
            return
        if method:
            self.events.append(
                kind="notification",
                method=str(method),
                params=safe_params,
            )

    def _fail_all_pending(self, message: str) -> None:
        with self._pending_lock:
            pending = list(self._pending.values())
        for response_queue in pending:
            try:
                response_queue.put_nowait(
                    {"error": {"code": -32_000, "message": message}}
                )
            except queue.Full:
                pass

    def _clear_server_requests(self, reason: str) -> None:
        with self._server_requests_lock:
            pending = list(self._server_requests.items())
            self._server_requests.clear()
        for request_key, request in pending:
            self.events.append(
                kind="bridge",
                method="bridge/approvalExpired",
                params={
                    "requestKey": request_key,
                    "requestMethod": request.method,
                    "reason": reason,
                    "threadId": request.params.get("threadId"),
                    "turnId": request.params.get("turnId"),
                },
            )

    def pending_request_count(self) -> int:
        with self._server_requests_lock:
            return len(self._server_requests)

    def pending_requests(self) -> list[dict[str, Any]]:
        """Return a safe snapshot of approval requests for UI recovery."""
        with self._server_requests_lock:
            items = list(self._server_requests.items())
        return [
            {
                "requestKey": request_key,
                "method": pending.method,
                "params": pending.params,
                "supported": pending.method in self.APPROVAL_METHODS,
            }
            for request_key, pending in items
        ]

    def resolve_approval(self, request_key: str, decision: str) -> None:
        if decision not in self.APPROVAL_DECISIONS:
            raise ConfigurationError(f"不支持的审批决定：{decision}")
        with self._server_requests_lock:
            pending = self._server_requests.get(request_key)
        if not pending:
            raise ConfigurationError("审批请求不存在、已过期或已处理。")
        if pending.method not in self.APPROVAL_METHODS:
            raise ConfigurationError(
                f"当前桥接器尚不支持处理该 Codex 请求：{pending.method}"
            )
        self._write_message(
            {"id": pending.raw_id, "result": {"decision": decision}}
        )
        with self._server_requests_lock:
            self._server_requests.pop(request_key, None)
        self.events.append(
            kind="bridge",
            method="bridge/approvalSubmitted",
            params={
                "requestKey": request_key,
                "requestMethod": pending.method,
                "decision": decision,
                "threadId": pending.params.get("threadId"),
                "turnId": pending.params.get("turnId"),
            },
        )
