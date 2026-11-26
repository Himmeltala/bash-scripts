# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_web_tool_wiring.py
# @Description: 服务端把 Node 与 JVM 接口装进同一个 Handler 的回归：前缀分派、缺引擎、注销与越界。

"""服务端把 Node 与 JVM 接口装进同一个 Handler 的回归：前缀分派、缺引擎、注销与越界。"""

import argparse
import contextlib
import http.client
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "src" / "idex"),
    str(REPO / "idex" / "src" / "idex" / "web"),
]
from testkit import json_call, read_sse_event, serve

import server as web
from routes_jvm import JvmRoutes
from server_stores import Workspaces
from sse import Fanout, SSEMixin
from web import ApiError


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


class WiringTestBase(unittest.TestCase):
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


class WiringTest(WiringTestBase):

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

    def test_tools_rescan_checks_write_permission(self):
        """远端不能借重扫改写工具映射。"""
        root = self.base / "proj"
        root.mkdir()
        self.store.save([workspace("w1", root)])

        def deny(_handler):
            raise ApiError(403, "写操作只允许本机发起")

        handler = type(
            "DenyHandler", (web.Handler,), {"store": self.store, "_check_write": deny}
        )
        with mock.patch("routes_workspaces.detect_tools") as detect:
            with serve(handler, api_prefix="/api") as srv:
                status, payload = json_call(srv.base, "tools/rescan", {"ws": "w1"})

        self.assertEqual(status, 403)
        self.assertEqual(payload["error"], "写操作只允许本机发起")
        detect.assert_not_called()
        self.assertEqual(self.store.tools("w1"), {})

    def test_workspace_write_routes_check_write_permission(self):
        """远端不能添加、移出工作区，也不能改别名、分组、设置或浏览家目录。"""
        root = self.base / "proj"
        root.mkdir()
        self.store.save([workspace("w1", root)])

        def deny(*_args):
            raise ApiError(403, "只允许本机")

        handler = type(
            "DenyHandler",
            (web.Handler,),
            {"store": self.store, "_check_write": deny, "_require_local": deny},
        )
        with serve(handler, api_prefix="/api") as srv:
            for route, body in (
                ("workspaces", {"root": str(root)}),
                ("forget", {"ws": "w1"}),
                ("alias", {"ws": "w1", "alias": "x"}),
                ("settings", {"search_ignore": []}),
                ("groups", {"nodes": []}),
            ):
                status, payload = json_call(srv.base, route, body)
                self.assertEqual(status, 403, route)
                self.assertEqual(payload["error"], "只允许本机", route)

            status, payload = json_call(srv.base, "dirs")
            self.assertEqual(status, 403)
            self.assertEqual(payload["error"], "只允许本机")

    def test_undetected_same_root_blocks_unregistration(self):
        """同目录但没有探测过的工作区还占着这个根，不能注销引擎工作区。"""
        root = self.base / "shared-undetected"
        tools = {"node": {"root": str(root), "id": "n1"}}
        self.store.save([workspace("w1", root, tools), workspace("w2", root)])
        node = FakeNode()

        with serve(self.handler(node=node), api_prefix="/api") as srv:
            status, _ = json_call(srv.base, "forget", {"ws": "w1"})

        self.assertEqual(status, 200)
        self.assertEqual(node.removed, [])
        self.assertIsNotNone(self.store.find("w2"))


_HANDLER_ATTRS = (
    "static",
    "store",
    "groups",
    "settings",
    "lsp",
    "api_prefix",
    "allow_write",
    "state_stream",
    "metrics_stream",
    "node_service",
    "jvm_app",
)


@contextlib.contextmanager
def handler_state():
    """_make_handler 直接改 Handler 类属性；用例结束后还原，不串到别的用例。"""
    saved = {name: getattr(web.Handler, name, None) for name in _HANDLER_ATTRS}
    try:
        yield
    finally:
        for name, value in saved.items():
            setattr(web.Handler, name, value)


class RecordingEngine:
    instances = []

    def __init__(self, *args):
        self.args = args
        self.started = False
        self.closed = False
        type(self).instances.append(self)

    def start_background(self):
        self.started = True

    def close(self):
        self.closed = True

    def state_payload(self):
        return {"workspaces": []}


class FakeNodeEngine(RecordingEngine):
    instances = []


class FakeJvmEngine(RecordingEngine):
    instances = []


class EngineStartupTest(WiringTestBase):
    def setUp(self):
        WiringTestBase.setUp(self)
        FakeNodeEngine.instances = []
        FakeJvmEngine.instances = []

    def make_args(self):
        return argparse.Namespace(
            state=str(self.base / "state.json"), api="/api", allow_write=False
        )

    def patch_engines(self, node_cls=FakeNodeEngine, jvm_cls=FakeJvmEngine):
        return mock.patch.multiple(web, NodeService=node_cls, JvmApp=jvm_cls)

    def test_engine_home_follows_xdg_cache(self):
        cache = self.base / "cache"
        with mock.patch.dict(os.environ, {"XDG_CACHE_HOME": str(cache)}):
            self.assertEqual(web._engine_home("nodex"), cache / "nodex" / "web")
            self.assertEqual(web._engine_home("jvmx"), cache / "jvmx" / "web")
        with mock.patch.dict(os.environ, {"XDG_CACHE_HOME": ""}):
            self.assertEqual(
                web._engine_home("nodex"), Path.home() / ".cache" / "nodex" / "web"
            )

    def test_make_handler_wires_engine_arguments(self):
        cache = self.base / "cache"
        with handler_state(), mock.patch.dict(os.environ, {"XDG_CACHE_HOME": str(cache)}):
            with self.patch_engines():
                web._make_handler(self.make_args(), self.base)

            node = FakeNodeEngine.instances[0]
            jvm = FakeJvmEngine.instances[0]
            script = str(REPO / "idex/src/idex/engines/node/engine.sh")
            node_home = cache / "nodex" / "web"
            self.assertEqual(node.args, (script, node_home, node_home / "custom.tsv"))
            self.assertEqual(jvm.args, (cache / "jvmx" / "web",))
            self.assertTrue(node.started)
            self.assertTrue(jvm.started)
            self.assertIs(web.Handler.node_service, node)
            self.assertIs(web.Handler.jvm_app, jvm)

    def test_cleanup_closes_both_engines(self):
        with handler_state():
            with self.patch_engines():
                web._make_handler(self.make_args(), self.base)

            node = FakeNodeEngine.instances[0]
            jvm = FakeJvmEngine.instances[0]
            web._cleanup()

        self.assertTrue(node.closed)
        self.assertTrue(jvm.closed)

    def test_one_engine_failure_keeps_the_other_usable(self):
        class BrokenNode:
            def __init__(self, *args, **kwargs):
                raise RuntimeError("Node 起不来")

        with handler_state():
            with self.patch_engines(node_cls=BrokenNode):
                web._make_handler(self.make_args(), self.base)

            self.assertIsNone(web.Handler.node_service)
            self.assertIsNotNone(web.Handler.jvm_app)
            with serve(web.Handler, api_prefix="/api") as srv:
                status, _ = json_call(srv.base, "node/state")
                self.assertEqual(status, 503)
                status, payload = json_call(srv.base, "jvm/state")
                self.assertEqual(status, 200)
                self.assertEqual(payload["workspaces"], [])
            web._cleanup()


def fanout(payload):
    stream = Fanout()
    stream.publish(payload)
    return stream


class StreamWiringTest(WiringTestBase):
    def read_event(self, srv, route):
        conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=10)
        self.addCleanup(conn.close)
        conn.request("GET", "/api/" + route)
        resp = conn.getresponse()
        self.addCleanup(resp.close)
        self.assertEqual(resp.status, 200, route)
        return resp, read_sse_event(resp)

    def test_engine_rescan_state_is_separate(self):
        self.assertIsNot(web.Handler._node_rescanning, web.Handler._jvm_rescanning)
        self.assertIsNot(web.Handler._node_rescan_lock, web.Handler._jvm_rescan_lock)

    def test_state_streams_dispatch(self):
        node = FakeNode()
        node.state_stream = fanout({"from": "node"})
        node.metrics_stream = fanout({"m": 1})
        jvm = FakeJvm()
        jvm.state_stream = fanout({"from": "jvm"})
        jvm.metrics_stream = fanout({"m": 2})

        with serve(self.handler(node=node, jvm=jvm), api_prefix="/api") as srv:
            for route, payload in (
                ("node/state/stream", {"from": "node"}),
                ("jvm/state/stream", {"from": "jvm"}),
            ):
                resp, (event, data) = self.read_event(srv, route)
                self.assertEqual(event, "state", route)
                self.assertEqual(json.loads(data), payload, route)
                resp.close()

    def test_log_streams_dispatch(self):
        node_logs = self.base / "node-logs"
        (node_logs / "r1").mkdir(parents=True)
        (node_logs / "r1" / "r1.log").write_text("node line\n", encoding="utf-8")
        jvm_logs = self.base / "jvm-logs"
        (jvm_logs / "r1").mkdir(parents=True)
        (jvm_logs / "r1" / "r1.log").write_text("jvm line\n", encoding="utf-8")

        node = FakeNode(node_logs)
        jvm = FakeJvm(jvm_logs)
        with serve(self.handler(node=node, jvm=jvm), api_prefix="/api") as srv:
            for route, text in (
                ("node/log/stream?run=r1", "node line"),
                ("jvm/log/stream?run=r1", "jvm line"),
            ):
                resp, (event, data) = self.read_event(srv, route)
                self.assertEqual(event, "tail", route)
                self.assertIn(text, data, route)
                resp.close()

    def test_log_stream_traversal_is_rejected(self):
        with serve(
            self.handler(node=FakeNode(self.base / "nl"), jvm=FakeJvm(self.base / "jl")),
            api_prefix="/api",
        ) as srv:
            for route in ("node/log/stream", "jvm/log/stream"):
                status, payload = json_call(srv.base, route + "?run=../..")
                self.assertEqual(status, 400, route)
                self.assertEqual(payload["error"], "运行号不对", route)


if __name__ == "__main__":
    unittest.main()
