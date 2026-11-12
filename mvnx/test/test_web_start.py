"""网页模式启动的回归测试：页面点启动时，-pl 必须带上模块。

漏了 -pl，mvn 就在工作区根目录整体跑，spring-boot:run 先落到没有主类的聚合 pom 上。
"""

import importlib.util
import tempfile
import threading
import time
import unittest
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2] / "mvnx" / "lib" / "mvnx" / "web" / "server.py"

spec = importlib.util.spec_from_file_location("mvnx_web_server", SERVER)
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)

FS = web.FS


def svc_row(svc_id, path, module, args):
    """一条 svc 行：类型|id|工作区|动作|工作目录|-pl 的值|参数|展示路径|展示命令。"""
    return [web.SVC_KIND, svc_id, "ws1", "run", path, module, args, "a", "mvn ..."]


def run_row(run_id, ws, tag, status="ready"):
    """一条 run 行：类型|运行号|工作区|动作|标签|目录|-pl|展示|-模块|参数|命令|会话号|端口|状态|开始|退出码|错误。"""
    return [web.RUN_KIND, run_id, ws, "run", tag, "/work", "", "展示 " + tag, "",
            "spring-boot:run", "mvn spring-boot:run", "4242", "8080", status, "1", "", ""]


class FakeState:
    def __init__(self, row, runs=None):
        self.row = row
        self.live = runs or []

    def rows(self):
        return [list(r) for r in self.live]

    def find(self, kind, ident):
        if kind == web.SVC_KIND and self.row[1] == ident:
            return web.Row(list(self.row))
        return None

    def runs(self, ws=None):
        out = []
        for r in self.live:
            if ws is not None and r[2] != ws:
                continue
            out.append(web.Row(list(r)))
        return out


class FakeSessions:
    def __init__(self):
        self.spawned = []

    def spawn(self, workdir, argv, log_path, env=None):
        self.spawned.append((workdir, list(argv)))
        return 4242


class FakeEngine(web.Engine):
    def __init__(self, row, logs, runs=None):
        self.sessions = FakeSessions()
        web.Engine.__init__(self, "mvnx", FakeState(row, runs), self.sessions, logs, None)

    def call(self, op, *params):
        if op == "reserve":
            # 运行号、执行目录、mvn 参数、预排行、代次，与 web_reserve 的回话一致。
            return FS.join(["run1", "/work", "spring-boot:run", "runline", "gen"])
        return ""


class StartArgvTest(unittest.TestCase):
    def start_with(self, module):
        row = svc_row("ws1.run.a-service", "/work", module, "spring-boot:run")
        engine = FakeEngine(row, Path(tempfile.mkdtemp(prefix="mvnx-start-")))
        engine.start({"svc": row[1]})
        return engine.sessions.spawned

    def test_module_passes_as_pl(self):
        spawned = self.start_with("runnet-admin/runnet-admin-service")
        self.assertEqual(
            spawned[0],
            ("/work", ["mvn", "-pl", "runnet-admin/runnet-admin-service", "spring-boot:run"]),
        )

    def test_no_module_runs_in_own_dir(self):
        spawned = self.start_with("")
        self.assertEqual(spawned[0], ("/work", ["mvn", "spring-boot:run"]))


class StartConflictTest(unittest.TestCase):
    """同一个工作区里的不同模块各跑各的；只有同一模块才挡。"""

    def start(self, svc_id, live):
        row = svc_row(svc_id, "/work", "", "spring-boot:run")
        engine = FakeEngine(row, Path(tempfile.mkdtemp(prefix="mvnx-start-")), live)
        engine.start({"svc": svc_id})
        return engine.sessions.spawned

    def test_other_module_in_same_workspace_starts(self):
        live = [run_row("ws1.run.a-service.100", "ws1", "a-service")]
        spawned = self.start("ws1.run.b-service", live)
        self.assertEqual(len(spawned), 1)

    def test_same_module_blocked(self):
        live = [run_row("ws1.run.a-service.100", "ws1", "a-service")]
        with self.assertRaises(web.ApiError) as ctx:
            self.start("ws1.run.a-service", live)
        self.assertEqual(ctx.exception.status, 409)

    def test_same_module_other_action_blocked(self):
        # 打包与启动读同一个 target，模块相同就不能并着跑，动作不同也一样。
        live = [run_row("ws1.run.a-service.100", "ws1", "a-service")]
        with self.assertRaises(web.ApiError) as ctx:
            self.start("ws1.package.a-service", live)
        self.assertEqual(ctx.exception.status, 409)

    def test_same_tag_in_other_workspace_starts(self):
        live = [run_row("ws9.run.a-service.100", "ws9", "a-service")]
        spawned = self.start("ws1.run.a-service", live)
        self.assertEqual(len(spawned), 1)

    def test_finished_run_does_not_block(self):
        live = [run_row("ws1.run.a-service.100", "ws1", "a-service", status="exited")]
        spawned = self.start("ws1.run.a-service", live)
        self.assertEqual(len(spawned), 1)


class MultiState:
    def __init__(self, rows):
        self.by_id = rows

    def find(self, kind, ident):
        row = self.by_id.get(ident)
        if kind == web.SVC_KIND and row is not None:
            return web.Row(list(row))
        return None

    def runs(self, ws=None):
        return []


class SlowSessions(FakeSessions):
    """起进程留一点时间，好让另一个启动请求在这一步插进来。"""

    def spawn(self, workdir, argv, log_path, env=None):
        sid = 5000 + len(self.spawned)
        self.spawned.append((workdir, list(argv)))
        time.sleep(0.3)
        return sid


class SharedPendingEngine(web.Engine):
    """模拟 bash 端的单个 pending 文件：reserve 写、launched 读走，两次启动共用一份。"""

    def __init__(self, svc_ids, logs):
        rows = {sid: svc_row(sid, "/work", "", "spring-boot:run") for sid in svc_ids}
        self.sessions = SlowSessions()
        web.Engine.__init__(self, "mvnx", MultiState(rows), self.sessions, logs, None)
        self.pending = None
        self.registered = {}

    def call(self, op, *params):
        if op == "reserve":
            self.pending = params[0]
            return FS.join([params[0] + ".1", "/work", "spring-boot:run", "line", "gen"])
        if op == "launched":
            sid, _gen = params
            svc, self.pending = self.pending, None
            if svc is None:
                # 与 web_launched 读不到预排行时的回话一致。
                raise web.ApiError(400, "这次启动已作废")
            self.registered[svc] = sid
        return ""


class ConcurrentStartTest(unittest.TestCase):
    def test_two_starts_keep_their_own_records(self):
        engine = SharedPendingEngine(["ws1.run.a", "ws1.run.b"], Path(tempfile.mkdtemp(prefix="mvnx-start-")))
        errors = []

        def start(svc_id):
            try:
                engine.start({"svc": svc_id})
            except Exception as exc:  # noqa: BLE001 - 记下来在断言里报
                errors.append(exc)

        first = threading.Thread(target=start, args=("ws1.run.a",))
        second = threading.Thread(target=start, args=("ws1.run.b",))
        first.start()
        # 等第一个启动进到起进程那一步，再发第二个。
        while not engine.sessions.spawned:
            time.sleep(0.01)
        second.start()
        first.join()
        second.join()

        self.assertEqual(errors, [])
        self.assertEqual(sorted(engine.registered), ["ws1.run.a", "ws1.run.b"])
        self.assertNotEqual(engine.registered["ws1.run.a"], engine.registered["ws1.run.b"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
