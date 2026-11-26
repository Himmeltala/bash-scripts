# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_web_node_routes.py
# @Description: Node 网页接口的回归测试。

import shutil
import sys, tempfile, threading, time, types, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "src" / "idex"),
    str(REPO / "idex" / "src" / "idex" / "web"),
]
from sse import SSEMixin
from web import ApiError
from routes_browse import zipx_command
from routes_node import NodeRoutes
import engines.node.engine as engine

class FakeService:
    def __init__(self): self.calls = []
    def has_workspace(self, ws): return ws == "n1"
    def state_payload(self): return {"workspaces": [{"id": "n1", "root": "/r"}]}
    def start(self, body): self.calls.append(("start", body)); return {"run": "r1"}
    def stop(self, run): self.calls.append(("stop", run))
    def restart(self, run): self.calls.append(("restart", run)); return {"run": "r2"}
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


class FailingService(FakeService):
    """后台重扫失败：错误要留在最后一个工作区上，供状态接口与轮询取。"""

    def add_workspace(self, root):
        self.calls.append(("add", root))
        raise ApiError(502, "引擎断开")

class FakeStore:
    def tools(self, wid): return {"node": {"root": "/r", "id": "n1"}} if wid == "i1" else {}

class RecordingEngine:
    def __init__(self): self.calls = []
    def call(self, op, *params):
        self.calls.append((op, params))
        return ""
    # 状态回话改用非阻塞心跳：抢不到引擎锁就不 tick。
    try_call = call

class ExplodingEngine:
    def call(self, op, *params): raise ApiError(502, "引擎断开")
    try_call = call

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

    def tearDown(self):
        NodeRoutes._node_rescan_errors.clear()

    def test_state(self):
        self.assertIn("workspaces", self.make()._node_dispatch("GET", "state", {}, {}))

    def test_start(self):
        self.assertEqual(self.make()._node_dispatch("POST", "start", {}, {"svc": "s1"}), {"run": "r1"})

    def test_restart(self):
        h = self.make()
        self.assertEqual(h._node_dispatch("POST", "restart", {}, {"run": "r1"}), {"run": "r2"})
        self.assertEqual(h.node_service.calls, [("restart", "r1")])

    def test_unregistered_is_409(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._node_ws("missing")
        self.assertEqual(ctx.exception.status, 409)

    def test_detected_but_not_engine_registered_is_409(self):
        """idex 探测出 id 但引擎状态里还没登记时，直接调接口要回 409。"""
        h = self.make()
        h.store = type("S", (), {"tools": lambda self_, wid: {"node": {"root": "/r", "id": "n9"}}})()
        with self.assertRaises(ApiError) as ctx:
            h._node_ws("i1")
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

    def test_rescan_failure_sets_error_and_releases_wait(self):
        """后台重扫失败不再只进日志：轮询接口给出原因，状态回话也带上。"""
        h = self.make(); h.node_service = FailingService()
        self.addCleanup(NodeRoutes._node_rescanning.discard, "n1")

        self.assertEqual(
            h._node_dispatch("POST", "rescan", {}, {"ws": "i1"}),
            {"ok": True, "started": True},
        )
        self.wait_clear()

        status = h._node_dispatch("GET", "rescan/status", {"ws": ["i1"]}, {})
        self.assertFalse(status["running"])
        self.assertIn("引擎断开", status["error"])

        state = h._node_dispatch("GET", "state", {}, {})
        self.assertEqual(state["workspaces"], [{"id": "n1", "root": "/r"}])
        self.assertIn("引擎断开", state["rescan_errors"]["n1"])

    def test_rescan_success_clears_previous_error(self):
        NodeRoutes._node_rescan_errors["n1"] = "扫描失败：旧错误"
        h = self.make()
        self.addCleanup(NodeRoutes._node_rescanning.discard, "n1")

        h._node_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.wait_clear()

        status = h._node_dispatch("GET", "rescan/status", {"ws": ["i1"]}, {})
        self.assertEqual(status["error"], "")

    def test_rescan_status_requires_node_workspace(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._node_dispatch("GET", "rescan/status", {"ws": ["missing"]}, {})
        self.assertEqual(ctx.exception.status, 409)

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




class NodeDownloadTest(unittest.TestCase):
    """打包产物下载：dist 经 zipx 压成 zip，第二次直接复用缓存。"""

    @unittest.skipUnless(zipx_command(), "需要可执行的 zipx")
    def test_download_packs_dist_and_reuses_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            app = home / "app"
            (app / "dist").mkdir(parents=True)
            (app / "dist" / "index.js").write_text("console.log(1)\n", encoding="utf-8")
            state_path = home / "state.tsv"
            state_path.write_text(
                "\n".join(
                    [
                        "\x1f".join(["ws", "w1", str(app), "1"]),
                        "\x1f".join(
                            ["run", "w1.build.demo.1", "w1", "build", "demo", str(app), ".",
                             ".", "", "pnpm build", "pnpm build", "", "", "exited", "1", "0", ""]
                        ),
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            service = types.SimpleNamespace()
            service.state = engine.State(state_path)
            service.home = home
            service.run_info = lambda rid: engine.run_info(service.state.find(engine.RUN_KIND, rid))

            h = NodeRoutes()
            h.node_service = service
            sent = {}
            h._send_download = lambda path, name, head=False: sent.update(
                path=str(path), name=name, head=head
            )

            h._node_download({"run": ["w1.build.demo.1"]})
            self.assertEqual(sent["name"], "demo.zip")
            first = Path(sent["path"])
            self.assertTrue(first.is_file())
            mtime = first.stat().st_mtime_ns

            h._node_download({"run": ["w1.build.demo.1"]})
            self.assertEqual(Path(sent["path"]).stat().st_mtime_ns, mtime)

            # HEAD 带同样的响应头，不再写正文。
            h._node_download({"run": ["w1.build.demo.1"]}, head=True)
            self.assertTrue(sent["head"])

    def test_download_requires_finished_build(self):
        service = types.SimpleNamespace()
        service.run_info = lambda rid: {"type": "dev", "status": "ready", "code": ""}
        h = NodeRoutes()
        h.node_service = service
        with self.assertRaises(ApiError) as caught:
            h._node_download({"run": ["x"]})
        self.assertEqual(caught.exception.status, 404)


if __name__ == "__main__":
    unittest.main()
