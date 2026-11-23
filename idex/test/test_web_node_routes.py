import sys, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "lib" / "idex"),
    str(REPO / "idex" / "lib" / "idex" / "web"),
]
from web import ApiError
from routes_node import NodeRoutes

class FakeService:
    def __init__(self): self.calls = []
    def state_payload(self): return {"workspaces": [{"id": "n1", "root": "/r"}]}
    def start(self, body): self.calls.append(("start", body)); return {"run": "r1"}
    def stop(self, run): self.calls.append(("stop", run))
    def add_workspace(self, root): self.calls.append(("add", root))

class FakeStore:
    def tools(self, wid): return {"node": {"root": "/r", "id": "n1"}} if wid == "i1" else {}

class NodeDispatchTest(unittest.TestCase):
    def make(self):
        h = NodeRoutes(); h.node_service = FakeService(); h.store = FakeStore()
        h._check_write = lambda: None
        return h

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


if __name__ == "__main__":
    unittest.main()
