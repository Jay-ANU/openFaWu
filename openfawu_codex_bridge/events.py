from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class BridgeEvent:
    sequence: int
    received_at: float
    kind: str
    method: str
    params: dict[str, Any]
    thread_id: str | None = None
    request_key: str | None = None

    def as_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "sequence": self.sequence,
            "receivedAt": self.received_at,
            "kind": self.kind,
            "method": self.method,
            "params": self.params,
            "threadId": self.thread_id,
        }
        if self.request_key:
            data["requestKey"] = self.request_key
        return data


class EventStore:
    def __init__(self, capacity: int = 4_000) -> None:
        self._events: deque[BridgeEvent] = deque(maxlen=max(100, capacity))
        self._next_sequence = 1
        self._condition = threading.Condition()

    @staticmethod
    def _thread_id(params: dict[str, Any]) -> str | None:
        direct = params.get("threadId")
        if isinstance(direct, str):
            return direct
        thread = params.get("thread")
        if isinstance(thread, dict) and isinstance(thread.get("id"), str):
            return thread["id"]
        return None

    def append(
        self,
        *,
        kind: str,
        method: str,
        params: dict[str, Any] | None = None,
        request_key: str | None = None,
    ) -> BridgeEvent:
        safe_params = params if isinstance(params, dict) else {}
        with self._condition:
            event = BridgeEvent(
                sequence=self._next_sequence,
                received_at=time.time(),
                kind=kind,
                method=method,
                params=safe_params,
                thread_id=self._thread_id(safe_params),
                request_key=request_key,
            )
            self._next_sequence += 1
            self._events.append(event)
            self._condition.notify_all()
            return event

    def read(
        self,
        *,
        after: int,
        wait_seconds: float = 0,
        thread_id: str | None = None,
        limit: int = 250,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + max(0, wait_seconds)
        with self._condition:
            while self._latest_sequence_locked() <= after and wait_seconds > 0:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                self._condition.wait(timeout=remaining)

            snapshot = list(self._events)
            oldest = snapshot[0].sequence if snapshot else self._next_sequence
            latest = self._latest_sequence_locked()
            reset_required = bool(snapshot and after < oldest - 1)
            selected = [event for event in snapshot if event.sequence > after]
            if thread_id:
                selected = [
                    event
                    for event in selected
                    if event.thread_id in {None, thread_id}
                ]
            selected = selected[: max(1, min(limit, 500))]
            cursor = selected[-1].sequence if selected else latest
            return {
                "events": [event.as_dict() for event in selected],
                "cursor": cursor,
                "oldestSequence": oldest,
                "latestSequence": latest,
                "resetRequired": reset_required,
            }

    def latest_sequence(self) -> int:
        with self._condition:
            return self._latest_sequence_locked()

    def _latest_sequence_locked(self) -> int:
        return self._next_sequence - 1
