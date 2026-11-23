"""服务端把 Node 与 JVM 接口装进同一个 Handler 的回归：前缀分派、缺引擎、注销与越界。"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "lib" / "idex"),
    str(REPO / "idex" / "lib" / "idex" / "web"),
]
from testkit import json_call, serve

import server as web
from routes_jvm import JvmRoutes
from server_stores import Workspaces
from sse import SSEMixin


class FakeNode:
    """只实现接线测试碰到的接口，日志目录指向临时位置。"""

    def __init__(self, logs=None):
        self.logs = Path(logs) if logs else Path("/nonexistent-node-logs")
        self.state_stream = None
        self.metrics_stream = None
        self.removed = []

    def state_payload(self):
        return {"workspaces": [{"id": "n1", "root": "/r"}]}

    def log_page(self, query):
        return {"run": (query.get("run") or [""])[0], "text": ""}

    def remove_workspace(self, ws):
        self.removed.append(ws)


class FakeJvm:
    def __init__(self, logs=None):
        self.logs = Path(logs) if logs else Path("/nonexistent-jvm-logs")
        self.state_stream = None
        self.metrics_stream = None
        self.removed = []

    def state_payload(self):
        return {"workspaces": [{"id": "j1", "root": "/j"}]}

    def forget_workspace(self, ws_id):
        self.removed.append(ws_id)


def workspace(wid, root, tools=None):
    item = {"id": wid, "root": str(root), "vcs": "git", "url": "", "alias": "", "added": 1}
    if tools is not None:
        item["tools"] = tools
    return item


class WiringTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.store = Workspaces(self.base / "state.json")

    def handler(self, node=None, jvm=None, store=None):
        return type(
            "TestHandler",
            (web.Handler,),
            {
                "node_service": node,
                "jvm_app": jvm,
                "store": store if store is not None else self.store,
            },
        )

    def test_node_and_jvm_state_routes(self):
        """两个前缀各自走到自己的状态接口，不落到 idex 的旧路由表。"""
        node = FakeNode()
        jvm = FakeJvm()
        with serve(self.handler(node=node, jvm=jvm), api_prefix="/api") as srv:
            status, payload = json_call(srv.base, "node/state")
            self.assertEqual(status, 200)
            self.assertEqual(payload["workspaces"], [{"id": "n1", "root": "/r"}])

            status, payload = json_call(srv.base, "jvm/state")
            self.assertEqual(status, 200)
            self.assertEqual(payload["workspaces"], [{"id": "j1", "root": "/j"}])

    def test_missing_engine_is_503(self):
        """引擎没起来时对应前缀回 503，不影响另一个。"""
        with serve(self.handler(node=None, jvm=FakeJvm()), api_prefix="/api") as srv:
            status, payload = json_call(srv.base, "node/state")
            self.assertEqual(status, 503)
            self.assertIn("error", payload)

            status, _ = json_call(srv.base, "jvm/state")
            self.assertEqual(status, 200)

        with serve(self.handler(node=FakeNode(), jvm=None), api_prefix="/api") as srv:
            status, payload = json_call(srv.base, "jvm/state")
            self.assertEqual(status, 503)
            self.assertIn("error", payload)

            status, _ = json_call(srv.base, "node/state")
            self.assertEqual(status, 200)

    def test_mro_picks_engine_helpers(self):
        """_require_local 由 JVM 路由提供，日志流由 SSEMixin 提供。"""
        self.assertIs(web.Handler._require_local, JvmRoutes._require_local)
        self.assertIs(web.Handler._stream_log, SSEMixin._stream_log)

    def test_tools_rescan_calls_detection_and_set_tools(self):
        root = self.base / "proj"
        root.mkdir()
        self.store.save([workspace("w1", root)])
        tools = {"jvm": {"root": str(root), "kind": "mvn", "id": "abc"}}

        with mock.patch("routes_workspaces.detect_tools", return_value=tools) as detect:
            with serve(self.handler(), api_prefix="/api") as srv:
                status, payload = json_call(srv.base, "tools/rescan", {"ws": "w1"})

        self.assertEqual(status, 200)
        self.assertEqual(payload["tools"], tools)
        detect.assert_called_once_with(str(root))
        self.assertEqual(self.store.tools("w1"), tools)

    def test_shared_engine_root_keeps_registration(self):
        """两个 idex 工作区指向同一引擎根时，移出其中一个不能注销引擎工作区。"""
        root = self.base / "shared"
        node_tools = {"node": {"root": str(root), "id": "n1"}}
        jvm_tools = {"jvm": {"root": str(root), "kind": "mvn", "id": "j1"}}
        tools = dict(node_tools, **jvm_tools)
        self.store.save([workspace("w1", root, tools), workspace("w2", root, tools)])
        node = FakeNode()
        jvm = FakeJvm()

        with serve(self.handler(node=node, jvm=jvm), api_prefix="/api") as srv:
            status, _ = json_call(srv.base, "forget", {"ws": "w1"})
            self.assertEqual(status, 200)
            self.assertIsNone(self.store.find("w1"))
            self.assertIsNotNone(self.store.find("w2"))
            self.assertEqual(node.removed, [])
            self.assertEqual(jvm.removed, [])

            status, _ = json_call(srv.base, "forget", {"ws": "w2"})
            self.assertEqual(status, 200)

        self.assertEqual(node.removed, ["n1"])
        self.assertEqual(jvm.removed, ["j1"])

    def test_log_run_traversal_is_rejected(self):
        """两个命名空间的日志接口都只认日志目录里的运行号。"""
        logs = self.base / "logs"
        logs.mkdir()
        outside = self.base / "outside.log"
        outside.write_text("secret\n", encoding="utf-8")

        with serve(
            self.handler(node=FakeNode(logs), jvm=FakeJvm(logs)), api_prefix="/api"
        ) as srv:
            for route in ("node/log", "jvm/log"):
                status, payload = json_call(srv.base, route + "?run=../../outside")
                self.assertEqual(status, 400, route)
                self.assertEqual(payload["error"], "运行号不对", route)


if __name__ == "__main__":
    unittest.main()
