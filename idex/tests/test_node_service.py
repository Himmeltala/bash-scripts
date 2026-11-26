# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_node_service.py
# @Description: Node 引擎的服务层：状态快照、Node 版本发现，以及执行端的启停。

"""Node 引擎的服务层：状态快照、Node 版本发现，以及执行端的启停。

原来 nodex 网页用例里的扫描结果解析、Node 版本选择与启停，改成直接调用引擎类；
另有一条走 ``engine.sh --engine`` 的协议测试，验证搬迁后的状态文件与扫描。
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "idex"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib" / "py-shared" / "services"))

from engines.node import engine
from stores import AliasStore, LayoutStore
from web import ApiError

FS = "\x1f"
ENGINE_SH = Path(__file__).resolve().parents[1] / "src" / "idex" / "engines" / "node" / "engine.sh"


def make_node(home):
    """造一个能通过校验的 Node 目录：只要有 bin/node 就算。"""
    bindir = Path(home) / "bin"
    bindir.mkdir(parents=True, exist_ok=True)
    exe = bindir / "node"
    exe.write_text("#!/bin/sh\n", encoding="utf-8")
    exe.chmod(0o755)
    return Path(home)


def write_state(path, rows):
    Path(path).write_text("\n".join(FS.join(row) for row in rows) + "\n", encoding="utf-8")


class DiscoverNodesTest(unittest.TestCase):
    def test_nvm_and_fnm_layouts(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            nvm = make_node(home / "nvm" / "v20.11.1")
            make_node(home / "nvm" / "v18.19.0")
            fnm = make_node(home / "fnm" / "v21.7.3" / "installation")

            found = engine.discover_nodes((home / "nvm", home / "fnm"))

            paths = [item["path"] for item in found]
            self.assertIn(str(nvm.resolve()), paths)
            self.assertIn(str(fnm.resolve()), paths)
            self.assertEqual([item["version"] for item in found], ["21.7.3", "20.11.1", "18.19.0"])

    def test_skips_symlink_and_missing_node_binary(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            real = make_node(root / "v20.0.0")
            (root / "current").symlink_to(real)
            (root / "v19.0.0" / "bin").mkdir(parents=True)

            found = engine.discover_nodes((root,))

            self.assertEqual([item["path"] for item in found], [str(real.resolve())])

    def test_missing_root_is_ignored(self):
        self.assertEqual(engine.discover_nodes((Path("/nonexistent/node-engine"),)), [])


class EffectiveNodeTest(unittest.TestCase):
    def test_existing_path_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = make_node(Path(tmp) / "v20")
            self.assertEqual(engine.effective_node(str(home)), str(home))

    def test_missing_path_falls_back_to_environment(self):
        self.assertEqual(engine.effective_node("/nonexistent/node-engine/node"), "")
        self.assertEqual(engine.effective_node(""), "")


class BuildEnvTest(unittest.TestCase):
    def test_prepends_node_bin(self):
        base = {"PATH": "/usr/bin:/bin"}
        env = engine.build_env("/opt/node", base)
        self.assertEqual(env["PATH"], "/opt/node/bin:/usr/bin:/bin")
        # 不动原来的环境字典。
        self.assertEqual(base["PATH"], "/usr/bin:/bin")

    def test_empty_node_keeps_environment(self):
        self.assertIsNone(engine.build_env(""))


class NodeStoreTest(unittest.TestCase):
    def test_roundtrip_and_remove(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = engine.NodeStore(Path(tmp) / "node.tsv")
            store.set("ws1", "/opt/node20")
            store.set("ws2", "/opt/node18")
            self.assertEqual(store.get("ws1"), "/opt/node20")
            self.assertEqual(store.get("ws2"), "/opt/node18")

            store.set("ws1", "")
            self.assertEqual(store.get("ws1"), "")
            store.set("ws2", "/opt/node18")
            store.remove("ws2")
            self.assertEqual(store.get("ws2"), "")

    def test_missing_file_reads_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = engine.NodeStore(Path(tmp) / "node.tsv")
            self.assertEqual(store.get("ws"), "")


class NodeServiceCloseTest(unittest.TestCase):
    def test_close_stops_streams_without_engine_process(self):
        """执行端还没起来时也要收掉两条推送线程，失败清理不能漏。"""
        class FakeStream:
            def __init__(self):
                self.stopped = False

            def stop(self):
                self.stopped = True

        with tempfile.TemporaryDirectory() as tmp:
            service = engine.NodeService("/bin/false", Path(tmp))
            streams = (FakeStream(), FakeStream())
            service.state_stream, service.metrics_stream = streams
            service.close()
        self.assertTrue(all(stream.stopped for stream in streams))


class AttachNodesTest(unittest.TestCase):
    def test_marks_missing_node(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = engine.NodeStore(Path(tmp) / "node.tsv")
            home = make_node(Path(tmp) / "v20")
            store.set("ok", str(home))
            store.set("gone", "/nonexistent/node-engine/node")

            snapshot = {"workspaces": [{"id": "ok"}, {"id": "gone"}, {"id": "none"}]}
            out = engine.attach_nodes(snapshot, store)

            self.assertEqual(out["workspaces"][0]["node"], str(home))
            self.assertFalse(out["workspaces"][0]["node_missing"])
            self.assertTrue(out["workspaces"][1]["node_missing"])
            self.assertEqual(out["workspaces"][2]["node"], "")


class SnapshotTest(unittest.TestCase):
    def test_scripts_services_and_latest_run(self):
        rows = [
            ["ws", "w1", "/tmp/demo", "1"],
            ["script", ".", "w1", "demo"],
            ["script", "packages/a", "w1", "@demo/a"],
            ["svc", "w1.dev.@demo/a", "w1", "dev", "/tmp/demo/packages/a", "packages/a",
             "run dev", "packages/a", "pnpm run dev", "pnpm"],
            ["run", "w1.dev.@demo/a.111", "w1", "dev", "@demo/a", "/tmp/demo/packages/a",
             "packages/a", "packages/a", "packages/a", "run dev", "pnpm run dev",
             "999", "5173", "ready", "1", "", ""],
            ["run", "w1.dev.@demo/a.222", "w1", "dev", "@demo/a", "/tmp/demo/packages/a",
             "packages/a", "packages/a", "packages/a", "run dev", "pnpm run dev",
             "1000", "", "starting", "2", "", ""],
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.tsv"
            write_state(path, rows)
            snap = engine.State(path).snapshot()

            ws = snap["workspaces"][0]
            self.assertEqual([p["rel"] for p in ws["scripts"]], [".", "packages/a"])
            self.assertEqual(ws["scripts"][0]["name"], "demo")
            svc = ws["services"][0]
            self.assertEqual(svc["pm"], "pnpm")
            self.assertEqual(svc["module"], "packages/a")
            # 同一服务跑过两次，只带最新那条。
            self.assertEqual(svc["run"]["id"], "w1.dev.@demo/a.222")
            self.assertEqual(svc["run"]["status"], "starting")


class StatePayloadTest(unittest.TestCase):
    def test_carries_aliases_groups_and_custom_flag(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.tsv"
            write_state(state_path, [
                ["ws", "w1", tmp, "1"],
                ["svc", "w1.dev.demo", "w1", "dev", tmp, ".", "run dev", ".", "npm run dev", "npm"],
                ["svc", "w1.dev.mock", "w1", "dev", tmp, ".", "npm run mock", ".", "npm run mock", ""],
            ])
            nodes = engine.NodeStore(Path(tmp) / "node.tsv")
            aliases = AliasStore(Path(tmp) / "alias.tsv")
            aliases.set("w1", "前端")
            layout = LayoutStore(Path(tmp) / "groups.json")
            layout.set([{"kind": "group", "id": "g1", "name": "工程"}])
            custom_path = Path(tmp) / "custom.tsv"
            custom_path.write_text("w1%cdev%c.%cmock%cnpm run mock\n" % (FS, FS, FS, FS), encoding="utf-8")
            custom = engine.CustomStore(custom_path)

            payload = engine.state_payload(engine.State(state_path), nodes, aliases, custom, layout)

            ws = payload["workspaces"][0]
            self.assertEqual(ws["alias"], "前端")
            self.assertEqual(payload["groups"], [{"kind": "group", "id": "g1", "name": "工程", "parent": ""}])
            services = {item["id"]: item for item in ws["services"]}
            self.assertFalse(services["w1.dev.demo"]["custom"])
            self.assertTrue(services["w1.dev.mock"]["custom"])


class FakeSessions:
    """执行端起进程的部分换成记录调用；返回的会话号就是进程组号。"""

    def __init__(self):
        self.spawned = []
        self.killed = []

    def spawn(self, workdir, argv, log_path, env=None):
        self.spawned.append((workdir, argv, log_path, env))
        return 4242

    def kill_group(self, sid, grace=10.0):
        self.killed.append(sid)


SVC_ROW = ["svc", "w1.dev.demo", "w1", "dev", "/tmp/demo", ".", "run dev", ".", "npm run dev", "npm"]
INSTALL_ROW = ["svc", "w1.install.demo", "w1", "install", "/tmp/demo", ".", "npm install", ".", "npm install", "npm"]


def run_row(ident, status, pid="12345", kind="dev", ws="w1"):
    return ["run", ident, ws, kind, "demo", "/tmp/demo", ".", ".", ".", "run dev",
            "npm run dev", pid, "", status, "1", "", ""]


class EngineServiceTest(unittest.TestCase):
    def make_engine(self, rows, nodes=None):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        state_path = Path(self.tmp.name) / "state.tsv"
        write_state(state_path, rows)
        sessions = FakeSessions()
        eng = engine.Engine("/bin/false", engine.State(state_path), sessions,
                            Path(self.tmp.name) / "logs", nodes)
        calls = []

        def call(op, *params):
            calls.append((op, params))
            return ""

        eng.call = call
        eng.calls = calls
        eng.sessions = sessions
        return eng

    def test_start_spawns_in_service_dir_with_selected_node(self):
        eng = self.make_engine([SVC_ROW])
        home = make_node(Path(self.tmp.name) / "node20")
        eng.nodes = engine.NodeStore(Path(self.tmp.name) / "node.tsv")
        eng.nodes.set("w1", str(home))
        eng.reserve = lambda svc, *extra: ("w1.dev.demo.1", "/tmp/demo", "npm run dev", "gen", "")

        out = eng.start({"svc": "w1.dev.demo"})

        self.assertEqual(out, {"run": "w1.dev.demo.1"})
        workdir, argv, log_path, env = eng.sessions.spawned[0]
        self.assertEqual(workdir, "/tmp/demo")
        self.assertEqual(argv, ["npm", "run", "dev"])
        self.assertEqual(log_path, Path(self.tmp.name) / "logs" / "w1" / "w1.dev.demo.1.log")
        self.assertTrue(env["PATH"].startswith(str(home.resolve()) + "/bin:"))
        self.assertEqual(eng.calls, [("launched", (4242, "gen"))])

    def test_start_without_live_node_falls_back_to_environment(self):
        eng = self.make_engine([SVC_ROW])
        with tempfile.TemporaryDirectory() as tmp:
            eng.nodes = engine.NodeStore(Path(tmp) / "node.tsv")
            eng.nodes.set("w1", "/nonexistent/node-engine/node")
            eng.reserve = lambda svc, *extra: ("w1.dev.demo.1", "/tmp/demo", "npm run dev", "gen", "")

            eng.start({"svc": "w1.dev.demo"})

        self.assertIsNone(eng.sessions.spawned[0][3])

    def test_start_saves_extra_args_before_launch(self):
        eng = self.make_engine([SVC_ROW])
        seen = []
        eng.reserve = lambda svc, *extra: seen.append(extra) or (
            "w1.dev.demo.1", "/tmp/demo", "npm run dev --host 0.0.0.0", "gen", "")

        eng.start({"svc": "w1.dev.demo", "extra": "--host 0.0.0.0"})

        self.assertEqual(eng.calls[0], ("update", ("w1.dev.demo", "run dev --host 0.0.0.0")))
        self.assertEqual(seen, [("--host 0.0.0.0",)])

    def test_start_rejects_service_already_running(self):
        eng = self.make_engine([SVC_ROW, run_row("w1.dev.demo.169", "ready")])
        eng.reserve = lambda svc, *extra: self.fail("不该走到启动")
        with self.assertRaises(ApiError) as caught:
            eng.start({"svc": "w1.dev.demo"})
        self.assertEqual(caught.exception.status, 409)

    def test_install_waits_for_same_workspace_install(self):
        eng = self.make_engine([
            INSTALL_ROW,
            run_row("w1.install.other.169", "starting", kind="install"),
        ])
        eng.reserve = lambda svc, *extra: self.fail("不该走到启动")
        with self.assertRaises(ApiError) as caught:
            eng.start({"svc": "w1.install.demo"})
        self.assertEqual(caught.exception.status, 409)

    def test_start_rejects_unknown_service(self):
        eng = self.make_engine([SVC_ROW])
        with self.assertRaises(ApiError) as caught:
            eng.start({"svc": "w1.dev.missing"})
        self.assertEqual(caught.exception.status, 404)

    def test_stop_kills_group_and_marks_stopped(self):
        eng = self.make_engine([SVC_ROW, run_row("w1.dev.demo.169", "ready")])

        eng.stop("w1.dev.demo.169")

        self.assertEqual(eng.sessions.killed, ["12345"])
        self.assertEqual(eng.calls, [("stop", ("w1.dev.demo.169",))])

    def test_stop_missing_run_is_conflict(self):
        eng = self.make_engine([SVC_ROW])
        with self.assertRaises(ApiError) as caught:
            eng.stop("w1.dev.demo.169")
        self.assertEqual(caught.exception.status, 409)


@unittest.skipUnless(shutil.which("node"), "需要 node 运行扫描脚本")
class EngineProtocolTest(unittest.TestCase):
    """走真实 engine.sh --engine：加工作区、扫描、自定义命令与 reserve/stop。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cache = Path(self.tmp.name) / "cache"
        self.cache.mkdir()
        self.root = Path(self.tmp.name) / "app"
        self.root.mkdir()
        (self.root / "package.json").write_text(
            '{"name":"solo","scripts":{"dev":"node .","build":"tsc"}}', encoding="utf-8"
        )
        self.home = Path(self.cache) / "nodex" / "web"
        self.old_cache = os.environ.get("XDG_CACHE_HOME")
        os.environ["XDG_CACHE_HOME"] = str(self.cache)
        self.addCleanup(self.restore_cache)
        self.state = engine.State(self.home / "state.tsv")
        self.sessions = FakeSessions()
        self.eng = engine.Engine(str(ENGINE_SH), self.state, self.sessions, self.home / "logs")
        self.addCleanup(self.close_engine)

    def restore_cache(self):
        if self.old_cache is None:
            os.environ.pop("XDG_CACHE_HOME", None)
        else:
            os.environ["XDG_CACHE_HOME"] = self.old_cache

    def close_engine(self):
        proc = self.eng.proc
        if proc is not None:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
            for stream in (proc.stdin, proc.stdout, proc.stderr):
                if stream is not None:
                    stream.close()

    def test_add_scans_and_writes_state(self):
        self.eng.add_workspace(str(self.root))

        self.assertTrue((self.home / "state.tsv").is_file())
        snap = self.state.snapshot()
        self.assertEqual(len(snap["workspaces"]), 1)
        ws = snap["workspaces"][0]
        self.assertEqual(ws["root"], str(self.root.resolve()))
        self.assertEqual([item["rel"] for item in ws["scripts"]], ["."])
        types = [item["type"] for item in ws["services"]]
        self.assertEqual(types.count("dev"), 1)
        self.assertEqual(types.count("build"), 1)
        self.assertIn("install", types)
        dev = next(item for item in ws["services"] if item["type"] == "dev")
        self.assertEqual(dev["cmd"], "npm run dev")

    def test_reserve_launched_and_stop_keep_state(self):
        self.eng.add_workspace(str(self.root))
        ws = self.state.snapshot()["workspaces"][0]
        dev = next(item for item in ws["services"] if item["type"] == "dev")

        runid, path, args, gen, line = self.eng.reserve(dev["id"])
        self.assertTrue(runid.startswith(dev["id"] + "."))
        self.assertEqual(path, str(self.root.resolve()))
        self.assertEqual(args, "npm run dev")
        self.assertTrue(line.startswith("run" + FS))

        # 引擎按会话号判断进程还在不在：起一条真 Node 进程，让状态停在 starting。
        fake = subprocess.Popen(
            [shutil.which("node"), "-e", "setTimeout(() => {}, 60000)"],
            start_new_session=True,
        )

        def stop_fake():
            if fake.poll() is not None:
                return
            fake.terminate()
            try:
                fake.wait(timeout=5)
            except subprocess.TimeoutExpired:
                fake.kill()

        self.addCleanup(stop_fake)
        self.eng.call("launched", str(fake.pid), gen)

        def dev_run():
            services = self.state.snapshot()["workspaces"][0]["services"]
            return next(item for item in services if item["id"] == dev["id"])["run"]

        self.assertEqual(dev_run()["status"], "starting")
        self.assertEqual(dev_run()["pid"], str(fake.pid))

        self.eng.stop(runid)
        self.assertEqual(self.sessions.killed, [str(fake.pid)])
        self.assertEqual(dev_run()["status"], "stopped")

    def write_package(self, root, name, scripts=None, extra=None):
        pkg = {"name": name}
        if scripts:
            pkg["scripts"] = scripts
        if extra:
            pkg.update(extra)
        path = Path(root) / "package.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(pkg), encoding="utf-8")

    def test_pnpm_workspace_scan_honours_excludes(self):
        """pnpm 工作区按 pnpm-workspace.yaml 圈成员，排除项与 node_modules 都不进扫描。"""
        root = Path(self.tmp.name) / "pnpm-ws"
        self.write_package(root, "demo-root", {"dev": "vite"})
        (root / "pnpm-workspace.yaml").write_text(
            "packages:\n  - 'packages/*'\n  - '!packages/skip'\n", encoding="utf-8"
        )
        (root / "pnpm-lock.yaml").write_text("", encoding="utf-8")
        self.write_package(root / "packages" / "app", "@demo/app",
                           {"dev": "vite", "build": "vite build"})
        self.write_package(root / "packages" / "skip", "@demo/skip", {"dev": "nope"})
        self.write_package(root / "node_modules" / "fake", "fake", {"dev": "nope"})

        self.eng.add_workspace(str(root))

        snap = self.state.snapshot()
        ws = snap["workspaces"][0]
        self.assertEqual([item["rel"] for item in ws["scripts"]], [".", "packages/app"])
        ids = [item["id"] for item in ws["services"]]
        self.assertIn(ws["id"] + ".dev.@demo/app", ids)
        self.assertIn(ws["id"] + ".build.@demo/app", ids)
        self.assertFalse(any("skip" in ident or "fake" in ident for ident in ids))

        app_dev = next(item for item in ws["services"] if item["id"] == ws["id"] + ".dev.@demo/app")
        self.assertEqual(app_dev["pm"], "pnpm")
        self.assertEqual(app_dev["cmd"], "pnpm run dev")
        root_dev = next(item for item in ws["services"] if item["id"] == ws["id"] + ".dev.demo-root")
        self.assertEqual(root_dev["pm"], "pnpm")
        self.assertEqual(root_dev["cmd"], "pnpm run dev")
        # 安装命令按 npm 的工作区选择器拼，与包管理器声明无关（原 nodex 口径）。
        app_install = next(
            item for item in ws["services"] if item["id"] == ws["id"] + ".install.@demo/app"
        )
        self.assertEqual(app_install["pm"], "pnpm")
        self.assertEqual(app_install["cmd"], "npm install --workspace @demo/app")

    def test_package_manager_field_beats_lockfile_and_install_trace(self):
        """packageManager 字段优先于锁文件与 node_modules 里的安装痕迹。"""
        root = Path(self.tmp.name) / "field"
        self.write_package(root, "field", {"dev": "serve", "build": "tsc"},
                           extra={"packageManager": "pnpm@9.0.0"})
        # 锁文件与安装痕迹都指向 yarn，字段仍应胜出。
        (root / "yarn.lock").write_text("", encoding="utf-8")
        (root / "package-lock.json").write_text("", encoding="utf-8")
        (root / "node_modules").mkdir()
        (root / "node_modules" / ".yarn-integrity").write_text("", encoding="utf-8")

        self.eng.add_workspace(str(root))

        snap = self.state.snapshot()
        ws = snap["workspaces"][0]
        dev = next(item for item in ws["services"] if item["type"] == "dev")
        build = next(item for item in ws["services"] if item["type"] == "build")
        self.assertEqual(dev["cmd"], "pnpm run dev")
        self.assertEqual(build["cmd"], "pnpm run build")

        raw = (self.home / "state.tsv").read_text(encoding="utf-8").splitlines()
        dev_row = next(line for line in raw if line.startswith("svc" + FS + ws["id"] + ".dev."))
        self.assertEqual(dev_row.split(FS)[9], "pnpm")
        self.assertEqual(dev_row.split(FS)[8], "pnpm run dev")

    def test_custom_commands_are_added_and_removed(self):
        self.eng.add_workspace(str(self.root))
        wsid = self.state.snapshot()["workspaces"][0]["id"]
        self.eng.call("addcmd", wsid, "dev", ".", "mock", "npm run mock")
        custom = engine.CustomStore(self.home / "custom.tsv")
        self.assertIn(wsid + ".dev.mock", custom.ids())
        self.assertIn(wsid + ".dev.mock",
                      [item["id"] for item in self.state.snapshot(custom)["workspaces"][0]["services"]])

        self.eng.call("delcmd", wsid + ".dev.mock")
        self.assertNotIn(wsid + ".dev.mock", custom.ids())
        self.assertNotIn(wsid + ".dev.mock",
                         [item["id"] for item in self.state.snapshot()["workspaces"][0]["services"]])


if __name__ == "__main__":
    unittest.main()
