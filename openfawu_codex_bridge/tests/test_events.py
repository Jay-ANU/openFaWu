from __future__ import annotations

import unittest

from openfawu_codex_bridge.events import EventStore


class EventStoreTest(unittest.TestCase):
    def test_sequence_and_thread_filter(self):
        store = EventStore(capacity=100)
        store.append(
            kind="notification",
            method="item/agentMessage/delta",
            params={"threadId": "a", "delta": "hello"},
        )
        store.append(
            kind="notification",
            method="item/agentMessage/delta",
            params={"threadId": "b", "delta": "other"},
        )
        store.append(kind="notification", method="account/updated", params={})
        result = store.read(after=0, thread_id="a")
        self.assertEqual(
            [event["method"] for event in result["events"]],
            ["item/agentMessage/delta", "account/updated"],
        )
        self.assertEqual(result["events"][0]["sequence"], 1)


if __name__ == "__main__":
    unittest.main()
