import sys, tempfile, threading, time, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "lib" / "idex"),
    str(REPO / "idex" / "lib" / "idex" / "web"),
]
from sse import SSEMixin
from web import ApiError
from routes_node import NodeRoutes

class FakeService:
    def __init__(self): self.calls = []
    def state_payload(self): return {"workspaces": [{"id": "n1", "root": "/r"}]}
    def start(self, body): self.calls.append(("start", body)); return {"run": "r1"}
    def stop(self, run): self.calls.append(("stop", run))
    def add_workspace(self, root): self.calls.append(("add", root))

class BlockingService(FakeService):
    """登记工作区时停住，好观察重扫线程的在跑标记。"""

    def __init__(self):
        FakeService.__init__(self)
        self.started = threading.Event()
        self.release = threading.Event()

    def add_workspace(self, root):
        self.calls.append(("add", root))
        self.started.set()
        self.release.wait(5)

class FakeStore:
    def tools(self, wid): return {"node": {"root": "/r", "id": "n1"}} if wid == "i1" else {}

class RecordingEngine:
    def __init__(self): self.calls = []
    def call(self, op, *params):
        self.calls.append((op, params))
        return ""

class ExplodingEngine:
    def call(self, op, *params): raise ApiError(502, "引擎断开")

class NodeDispatchTest(unittest.TestCase):
    def make(self):
        h = NodeRoutes(); h.node_service = FakeService(); h.store = FakeStore()
        h._check_write = lambda: None
        return h

    def wait_clear(self, key="n1"):
        deadline = time.time() + 5
        while key in NodeRoutes._node_rescanning and time.time() < deadline:
            time.sleep(0.01)
        self.assertNotIn(key, NodeRoutes._node_rescanning)

    def test_state(self):
        self.assertIn("workspaces", self.make()._node_dispatch("GET", "state", {}, {}))

    def test_start(self):
        self.assertEqual(self.make()._node_dispatch("POST", "start", {}, {"svc": "s1"}), {"run": "r1"})

    def test_unregistered_is_409(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._node_ws("missing")
        self.assertEqual(ctx.exception.status, 409)

    def test_write_checks_local(self):
        h = self.make()
        h._check_write = lambda: (_ for _ in ()).throw(ApiError(403, "只允许本机"))
        with self.assertRaises(ApiError) as ctx:
            h._node_dispatch("POST", "start", {}, {"svc": "s1"})
        self.assertEqual(ctx.exception.status, 403)

    def test_rescan_registers_detected_workspace(self):
        """探测到 id 不代表引擎状态里有 ws 行；按根目录重加才会登记并扫描。"""
        svc = BlockingService()
        h = self.make(); h.node_service = svc
        self.addCleanup(NodeRoutes._node_rescanning.discard, "n1")
        self.addCleanup(svc.release.set)

        out = h._node_dispatch("POST", "rescan", {}, {"ws": "i1"})

        self.assertEqual(out, {"ok": True, "started": True})
        self.assertTrue(svc.started.wait(2))
        self.assertEqual(svc.calls, [("add", "/r")])
        svc.release.set()
        self.wait_clear()

    def test_rescan_duplicate_is_409(self):
        svc = BlockingService()
        h = self.make(); h.node_service = svc
        self.addCleanup(NodeRoutes._node_rescanning.discard, "n1")
        self.addCleanup(svc.release.set)

        h._node_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertTrue(svc.started.wait(2))
        with self.assertRaises(ApiError) as ctx:
            h._node_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertEqual(ctx.exception.status, 409)
        svc.release.set()
        self.wait_clear()

    def test_rescan_flag_clears_after_thread(self):
        svc = BlockingService()
        h = self.make(); h.node_service = svc
        self.addCleanup(NodeRoutes._node_rescanning.discard, "n1")
        self.addCleanup(svc.release.set)

        h._node_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertTrue(svc.started.wait(2))
        self.assertIn("n1", NodeRoutes._node_rescanning)
        svc.release.set()
        self.wait_clear()

        # 跑完之后同一工作区还能再排一次。
        self.assertEqual(
            h._node_dispatch("POST", "rescan", {}, {"ws": "i1"}),
            {"ok": True, "started": True},
        )
        self.wait_clear()

    def test_log_stream_uses_service_logs(self):
        self.assertIs(NodeRoutes._stream_log, SSEMixin._stream_log)
        h = self.make()
        h.node_service.logs = "/tmp/node-logs"
        seen = []
        h._stream_log = lambda run: seen.append(run)

        h._node_log_stream({"run": ["r1"]})

        self.assertEqual(seen, ["r1"])
        self.assertEqual(h.logs, "/tmp/node-logs")

    def test_state_payload_ticks_engine(self):
        from engines.node.engine import NodeService

        with tempfile.TemporaryDirectory() as tmp:
            svc = NodeService("/bin/false", Path(tmp))
            engine = RecordingEngine()
            svc.engine = engine

            payload = svc.state_payload()

            self.assertIn("workspaces", payload)
            self.assertEqual(engine.calls, [("tick", ())])

            # 引擎断开时 tick 失败不该挡住状态回话。
            svc.engine = ExplodingEngine()
            self.assertIn("workspaces", svc.state_payload())


if __name__ == "__main__":
    unittest.main()
