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
from routes_jvm import JvmRoutes

class FakeEngineStore:
    """引擎侧的工作区表；add 模拟按根目录算出的新 id。"""

    def __init__(self, known=()):
        self.known = set(known)
        self.added = []

    def find(self, wid):
        return {"id": wid} if wid in self.known else None

    def add(self, root, kind):
        self.added.append((root, kind))
        self.known.add("j1")
        return {"id": "j1"}

class FakeRuns:
    def __init__(self):
        self.rows = {}

    def find(self, runid):
        return self.rows.get(runid)

class FakeApp:
    def __init__(self):
        self.calls = []
        self.scans = []
        self.store = FakeEngineStore()
        self.runs = FakeRuns()
        self.logs = Path("/tmp/jvm-logs")

    def state_payload(self):
        return {"workspaces": []}

    def jdks(self):
        return [{"path": "/jdk"}]

    def start_service(self, body):
        self.calls.append(("start", body))
        return {"run": "r1"}

    def stop_service(self, run):
        self.calls.append(("stop", run))

    def restart_service(self, body):
        self.calls.append(("restart", body))
        return {"run": "r2"}

    def update_service(self, body):
        self.calls.append(("update", body))

    def set_jdk(self, ws, jdk):
        self.calls.append(("jdk", ws, jdk))

    def scan(self, wid, strict=True):
        self.scans.append((wid, strict))

class BlockingApp(FakeApp):
    """扫描停住，好观察重扫线程的在跑标记。"""

    def __init__(self):
        FakeApp.__init__(self)
        self.started = threading.Event()
        self.release = threading.Event()

    def scan(self, wid, strict=True):
        self.scans.append((wid, strict))
        self.started.set()
        self.release.wait(5)

class FakeStore:
    def __init__(self, jvm=None):
        self.jvm = jvm if jvm is not None else {"root": "/r", "kind": "mvn", "id": "j1"}

    def tools(self, wid):
        if wid == "i1":
            return {"jvm": self.jvm}
        return {}

class JvmDispatchTest(unittest.TestCase):
    def make(self):
        h = JvmRoutes(); h.jvm_app = FakeApp(); h.store = FakeStore()
        h._check_write = lambda: None; h._require_local = lambda *_: None
        return h

    def tearDown(self):
        JvmRoutes._jvm_rescan_errors.clear()

    def wait_clear(self, key="j1"):
        deadline = time.time() + 5
        while key in JvmRoutes._jvm_rescanning and time.time() < deadline:
            time.sleep(0.01)
        self.assertNotIn(key, JvmRoutes._jvm_rescanning)

    def test_state(self):
        self.assertIn("workspaces", self.make()._jvm_dispatch("GET", "state", {}, {}))

    def test_start(self):
        self.assertEqual(self.make()._jvm_dispatch("POST", "start", {}, {"svc": "x"}), {"run": "r1"})

    def test_stop(self):
        h = self.make()
        self.assertEqual(h._jvm_dispatch("POST", "stop", {}, {"run": "r1"}), {"ok": True})
        self.assertEqual(h.jvm_app.calls, [("stop", "r1")])

    def test_restart(self):
        h = self.make()
        self.assertEqual(h._jvm_dispatch("POST", "restart", {}, {"run": "r1"}), {"run": "r2"})
        self.assertEqual(h.jvm_app.calls, [("restart", {"run": "r1"})])

    def test_update(self):
        h = self.make()
        self.assertEqual(h._jvm_dispatch("POST", "update", {}, {"svc": "s1"}), {"ok": True})
        self.assertEqual(h.jvm_app.calls, [("update", {"svc": "s1"})])

    def test_jdk_maps_workspace_id(self):
        h = self.make()
        self.assertEqual(h._jvm_dispatch("POST", "jdk", {}, {"ws": "i1", "jdk": "/jdk"}), {"ok": True})
        self.assertEqual(h.jvm_app.calls, [("jdk", "j1", "/jdk")])

    def test_jdks(self):
        out = self.make()._jvm_dispatch("GET", "jdks", {}, {})
        self.assertEqual(out["jdks"], [{"path": "/jdk"}])
        self.assertIn("current", out)

    def test_unregistered_is_409(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._jvm_ws("missing")
        self.assertEqual(ctx.exception.status, 409)

    def test_blank_engine_id_is_409(self):
        h = self.make(); h.store = FakeStore({"root": "/r", "kind": "mvn", "id": ""})
        with self.assertRaises(ApiError) as ctx:
            h._jvm_ws("i1")
        self.assertEqual(ctx.exception.status, 409)

    def test_write_checks_local(self):
        h = self.make()
        h._check_write = lambda: (_ for _ in ()).throw(ApiError(403, "只允许本机"))
        with self.assertRaises(ApiError) as ctx:
            h._jvm_dispatch("POST", "start", {}, {"svc": "x"})
        self.assertEqual(ctx.exception.status, 403)

    def test_jdks_requires_local(self):
        h = JvmRoutes(); h.jvm_app = FakeApp(); h.store = FakeStore()
        h.client_address = ("10.0.0.2", 1234)
        h.allow_write = False
        with self.assertRaises(ApiError) as ctx:
            h._jvm_dispatch("GET", "jdks", {}, {})
        self.assertEqual(ctx.exception.status, 403)

    def test_jdks_allows_loopback(self):
        h = JvmRoutes(); h.jvm_app = FakeApp(); h.store = FakeStore()
        h.client_address = ("127.0.0.1", 1234)
        h.allow_write = False
        self.assertIn("jdks", h._jvm_dispatch("GET", "jdks", {}, {}))

    def test_dirs_requires_local(self):
        h = JvmRoutes(); h.jvm_app = FakeApp(); h.store = FakeStore()
        h.client_address = ("10.0.0.2", 1234)
        h.allow_write = False
        with self.assertRaises(ApiError) as ctx:
            h._jvm_dispatch("GET", "dirs", {"path": [str(Path.home())]}, {})
        self.assertEqual(ctx.exception.status, 403)

    def test_log_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            logs = Path(tmp) / "logs"
            run_log = logs / "r1" / "r1.log"
            run_log.parent.mkdir(parents=True)
            run_log.write_text("one\ntwo\n", encoding="utf-8")
            h = self.make()
            h.jvm_app.logs = logs
            h.jvm_app.runs.rows["r1"] = {"status": "running", "code": ""}

            out = h._jvm_dispatch("GET", "log", {"run": ["r1"]}, {})

        self.assertEqual(out["run"], "r1")
        self.assertEqual(out["status"], "running")
        self.assertIn("two", out["text"])

    def test_log_runid_cannot_escape_logs(self):
        with tempfile.TemporaryDirectory() as tmp:
            logs = Path(tmp) / "logs"
            logs.mkdir()
            outside = Path(tmp) / "outside.log"
            outside.write_text("secret\n", encoding="utf-8")
            h = self.make()
            h.jvm_app.logs = logs

            with self.assertRaises(ApiError) as ctx:
                h._jvm_dispatch("GET", "log", {"run": ["../outside"]}, {})

        self.assertEqual(ctx.exception.status, 400)
        self.assertEqual(ctx.exception.message, "运行号不对")

    def test_log_stream_uses_app_logs(self):
        self.assertIs(JvmRoutes._stream_log, SSEMixin._stream_log)
        h = self.make()
        h.jvm_app.logs = "/tmp/jvm-logs"
        seen = []
        h._stream_log = lambda run: seen.append(run)

        h._jvm_log_stream({"run": ["r1"]})

        self.assertEqual(seen, ["r1"])
        self.assertEqual(h.logs, "/tmp/jvm-logs")

    def test_rescan_scan_existing_workspace(self):
        h = self.make()
        h.jvm_app.store = FakeEngineStore(["j1"])

        out = h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})

        self.assertEqual(out, {"ok": True, "started": True})
        self.wait_clear()
        self.assertEqual(h.jvm_app.scans, [("j1", False)])
        self.assertEqual(h.jvm_app.store.added, [])

    def test_rescan_registers_missing_workspace(self):
        h = self.make()

        out = h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})

        self.assertEqual(out, {"ok": True, "started": True})
        self.wait_clear()
        self.assertEqual(h.jvm_app.store.added, [("/r", "mvn")])
        self.assertEqual(h.jvm_app.scans, [("j1", False)])

    def test_rescan_duplicate_is_409(self):
        app = BlockingApp()
        h = self.make(); h.jvm_app = app
        self.addCleanup(JvmRoutes._jvm_rescanning.discard, "j1")
        self.addCleanup(app.release.set)

        h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertTrue(app.started.wait(2))
        with self.assertRaises(ApiError) as ctx:
            h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertEqual(ctx.exception.status, 409)
        app.release.set()
        self.wait_clear()

    def test_rescan_flag_clears_after_thread(self):
        app = BlockingApp()
        h = self.make(); h.jvm_app = app
        self.addCleanup(JvmRoutes._jvm_rescanning.discard, "j1")
        self.addCleanup(app.release.set)

        h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertTrue(app.started.wait(2))
        self.assertIn("j1", JvmRoutes._jvm_rescanning)
        app.release.set()
        self.wait_clear()

        self.assertEqual(
            h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"}),
            {"ok": True, "started": True},
        )
        app.release.set()
        self.wait_clear()

    def test_rescan_status_reports_scan_error(self):
        class ErrorApp(FakeApp):
            def scan(self, wid, strict=True):
                self.scans.append((wid, strict))
                return "找不到 pom"

        h = self.make(); h.jvm_app = ErrorApp()

        h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.wait_clear()

        status = h._jvm_dispatch("GET", "rescan/status", {"ws": ["i1"]}, {})
        self.assertFalse(status["running"])
        self.assertIn("找不到 pom", status["error"])

        state = h._jvm_dispatch("GET", "state", {}, {})
        self.assertIn("找不到 pom", state["rescan_errors"]["j1"])

    def test_rescan_success_clears_previous_error(self):
        JvmRoutes._jvm_rescan_errors["j1"] = "扫描失败：旧错误"
        h = self.make()

        h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.wait_clear()

        status = h._jvm_dispatch("GET", "rescan/status", {"ws": ["i1"]}, {})
        self.assertEqual(status["error"], "")

    def test_rescan_status_requires_jvm_workspace(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._jvm_dispatch("GET", "rescan/status", {"ws": ["missing"]}, {})
        self.assertEqual(ctx.exception.status, 409)

    def test_rescan_unknown_kind_is_400(self):
        h = self.make(); h.store = FakeStore({"root": "/r", "kind": "ant", "id": "j1"})
        with self.assertRaises(ApiError) as ctx:
            h._jvm_dispatch("POST", "rescan", {}, {"ws": "i1"})
        self.assertEqual(ctx.exception.status, 400)

    def test_rescan_unregistered_ws_is_409(self):
        h = self.make()
        with self.assertRaises(ApiError) as ctx:
            h._jvm_dispatch("POST", "rescan", {}, {"ws": "missing"})
        self.assertEqual(ctx.exception.status, 409)

    def test_unknown_route_is_404(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._jvm_dispatch("GET", "nope", {}, {})
        self.assertEqual(ctx.exception.status, 404)

    def test_write_route_rejects_get(self):
        with self.assertRaises(ApiError) as ctx:
            self.make()._jvm_dispatch("GET", "start", {}, {})
        self.assertEqual(ctx.exception.status, 405)


if __name__ == "__main__":
    unittest.main()
