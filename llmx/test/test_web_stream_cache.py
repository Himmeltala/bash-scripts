"""推送连接的周转：同一查询窗口内只算一次，对端断开能提早发现。"""

import socket
import sys
import threading
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "lib"))

from llmx import web as llmx_web


class PayloadCacheTest(unittest.TestCase):
    def setUp(self):
        self.now = 0.0
        self.cache = llmx_web._PayloadCache(clock=lambda: self.now)

    def test_same_key_reuses_payload_within_ttl(self):
        builds = []

        def build():
            builds.append(1)
            return {"n": len(builds)}

        first = self.cache.get(("a",), 3, build)
        second = self.cache.get(("a",), 3, build)
        self.assertIs(first, second)
        self.assertEqual(len(builds), 1)

    def test_expired_entry_is_rebuilt(self):
        builds = []

        def build():
            builds.append(1)
            return len(builds)

        self.cache.get(("a",), 3, build)
        self.now = 3.1
        self.assertEqual(self.cache.get(("a",), 3, build), 2)
        self.assertEqual(len(builds), 2)

    def test_different_keys_build_separately(self):
        builds = []
        self.cache.get(("a",), 3, lambda: builds.append("a") or "a")
        self.cache.get(("b",), 3, lambda: builds.append("b") or "b")
        self.assertEqual(builds, ["a", "b"])

    def test_concurrent_callers_share_one_build(self):
        entered = threading.Event()
        release = threading.Event()
        builds = []

        def build():
            builds.append(1)
            entered.set()
            release.wait(5)
            return {"ok": True}

        results = []
        threads = [
            threading.Thread(target=lambda: results.append(self.cache.get(("a",), 30, build)))
            for _ in range(8)
        ]
        for thread in threads:
            thread.start()
        self.assertTrue(entered.wait(5))
        release.set()
        for thread in threads:
            thread.join(5)
        self.assertEqual(len(builds), 1)
        self.assertEqual(len(results), 8)
        self.assertTrue(all(result == {"ok": True} for result in results))


class PeerClosedTest(unittest.TestCase):
    def test_open_peer_is_not_closed(self):
        mine, theirs = socket.socketpair()
        self.addCleanup(mine.close)
        self.addCleanup(theirs.close)
        self.assertFalse(llmx_web._peer_closed(mine))

    def test_closed_peer_is_detected(self):
        mine, theirs = socket.socketpair()
        self.addCleanup(mine.close)
        theirs.close()
        self.assertTrue(llmx_web._peer_closed(mine))


if __name__ == "__main__":
    unittest.main(verbosity=2)
