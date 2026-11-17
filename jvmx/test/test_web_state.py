"""jvmx 网页端回归：工作区登记、目标合成、启停、日志与非法目录。

用假的 mvn / gradle 脚本顶替真实构建工具，PATH 前置；工具本身（mvnx / gradlex）
仍是仓库里的真实入口，这样测到的是两边机器接口的衔接。
"""

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "jvmx" / "lib"))

import testkit  # noqa: E402

from jvmx.app import App  # noqa: E402

MVN_PORT = "18080"
GRADLE_PORT = "18081"
API = "/__jvmx/api"


def write_fake(bindir, name, port, container):
    exe = Path(bindir) / name
    exe.write_text(
        "#!/usr/bin/env bash\n"
        "printf 'fake-%s %%s\\n' \"$*\"\n"
        "printf 'JAVA_HOME=%%s\\n' \"${JAVA_HOME:-}\"\n"
        "printf '%s started on port %s\\n'\n"
        "sleep 60\n" % (name, container, port),
        encoding="utf-8",
    )
    exe.chmod(0o755)
    return exe


def make_mvn_project(root):
    root = Path(root)
    (root / "src" / "main" / "java" / "demo").mkdir(parents=True)
    (root / "pom.xml").write_text(
        """<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>demo-app</artifactId>
  <version>1.0</version>
  <packaging>jar</packaging>
  <build><plugins><plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
  </plugin></plugins></build>
</project>
""",
        encoding="utf-8",
    )
    (root / "src" / "main" / "java" / "demo" / "App.java").write_text(
        "package demo;\n@SpringBootApplication\n"
        "public class App { public static void main(String[] a) {} }\n",
        encoding="utf-8",
    )
    return root


def make_gradle_project(root):
    root = Path(root)
    (root / "src" / "main" / "java" / "demo").mkdir(parents=True)
    (root / "settings.gradle").write_text("rootProject.name = 'demo-gradle'\n", encoding="utf-8")
    (root / "build.gradle").write_text(
        "plugins {\n    id 'org.springframework.boot' version '3.0.0'\n}\n",
        encoding="utf-8",
    )
    (root / "src" / "main" / "java" / "demo" / "App.java").write_text(
        "package demo;\n@SpringBootApplication\n"
        "public class App { public static void main(String[] a) {} }\n",
        encoding="utf-8",
    )
    return root


def make_jdk(root):
    root = Path(root)
    (root / "bin").mkdir(parents=True)
    for name in ("java", "javac"):
        exe = root / "bin" / name
        exe.write_text("#!/bin/sh\n", encoding="utf-8")
        exe.chmod(0o755)
    (root / "release").write_text(
        'JAVA_VERSION="17.0.9"\nIMPLEMENTOR="Demo JDK"\n', encoding="utf-8"
    )
    return root


class WebStateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="jvmx-web-"))
        cls.fakebin = cls.tmp / "fakebin"
        cls.fakebin.mkdir()
        write_fake(cls.fakebin, "mvn", MVN_PORT, "Tomcat")
        write_fake(cls.fakebin, "gradle", GRADLE_PORT, "Jetty")
        cls.old_path = os.environ.get("PATH", "")
        os.environ["PATH"] = "%s:%s" % (cls.fakebin, cls.old_path)

        cls.mvn_root = make_mvn_project(cls.tmp / "mvnproj")
        cls.gradle_root = make_gradle_project(cls.tmp / "gradleproj")
        cls.empty = cls.tmp / "empty"
        cls.empty.mkdir()
        cls.both = cls.tmp / "both"
        cls.both.mkdir()
        (cls.both / "pom.xml").write_text("<project/>\n", encoding="utf-8")
        (cls.both / "settings.gradle").write_text("rootProject.name = 'both'\n", encoding="utf-8")

    @classmethod
    def tearDownClass(cls):
        os.environ["PATH"] = cls.old_path
        import shutil

        shutil.rmtree(str(cls.tmp), ignore_errors=True)

    def setUp(self):
        self.home = Path(tempfile.mkdtemp(dir=str(self.tmp), prefix="home-"))
        self.app = App(self.home, jdk_roots=())
        self.app.start_background()
        # 纯接口测试不需要打包好的页面。
        self.server = testkit.serve(self.app.make_handler(), api_prefix=API)

    def tearDown(self):
        for run in self.app.runs.snapshot():
            if run.get("status") in ("starting", "ready"):
                try:
                    self.app.runs.stop(run["id"])
                except Exception:
                    self.app.runs.sessions.kill_group(run.get("pid", ""))
        self.server.shutdown()
        self.app.close()

    # 小工具

    def add(self, root):
        status, data = testkit.json_call(self.server.base, "/workspaces", {"root": str(root)})
        self.assertEqual(status, 200, data)
        return data

    def state(self):
        status, data = testkit.json_call(self.server.base, "/state")
        self.assertEqual(status, 200, data)
        return data

    def workspace(self, kind):
        for ws in self.state()["workspaces"]:
            if ws["kind"] == kind:
                return ws
        self.fail("状态里没有 %s 工作区" % kind)

    def service(self, ws, kind):
        for svc in ws["services"]:
            if svc["type"] == kind:
                return svc
        self.fail("工作区里没有 %s 服务" % kind)

    def wait_run(self, ws_id, svc_id, statuses, timeout=10):
        def check():
            for ws in self.state()["workspaces"]:
                if ws["id"] != ws_id:
                    continue
                for svc in ws["services"]:
                    if svc["id"] != svc_id or not svc["run"]:
                        continue
                    if svc["run"]["status"] in statuses:
                        return svc["run"]
            return None

        return testkit.poll_until(check, timeout=timeout, message="等不到运行状态 %s" % (statuses,))

    def read_event(self, path, want, timeout=10):
        url = self.server.url + API + path
        deadline = time.time() + timeout
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            while time.time() < deadline:
                event, data = testkit.read_sse_event(resp)
                if event == want:
                    return json.loads(data)
        self.fail("没有收到 %s 事件" % want)

    # 用例

    def test_01_add_mvn_workspace(self):
        data = self.add(self.mvn_root)
        self.assertTrue(data["ok"], data)
        ws = self.workspace("mvn")
        self.assertEqual(ws["root"], str(self.mvn_root.resolve()))
        self.assertEqual(ws["kind"], "mvn")
        self.assertTrue(ws["services"])
        types = set(svc["type"] for svc in ws["services"])
        self.assertIn("run", types)
        self.assertIn("package", types)
        self.assertIn("install", types)
        self.assertTrue(ws["poms"])

        run = self.service(ws, "run")
        self.assertTrue(run["id"].startswith(ws["id"] + "."))
        self.assertEqual(run["tag"], "demo-app")
        self.assertEqual(run["cmd"], "mvn spring-boot:run")
        self.assertIsNone(run["run"])
        # 状态文件确实落在 state.json 里。
        saved = json.loads((self.home / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["workspaces"][0]["kind"], "mvn")

        status, _ = testkit.json_call(self.server.base, "/rescan", {"ws": ws["id"]})
        self.assertEqual(status, 200)

    def test_02_add_gradle_workspace(self):
        self.add(self.gradle_root)
        ws = self.workspace("gradle")
        self.assertEqual(ws["kind"], "gradle")
        self.assertEqual(sorted(svc["type"] for svc in ws["services"]), ["build", "run"])
        self.assertEqual(ws["poms"], [])
        self.assertEqual(self.service(ws, "run")["cmd"], "gradle bootRun")

    def test_03_alias_groups_and_jdk(self):
        self.add(self.mvn_root)
        ws = self.workspace("mvn")

        status, _ = testkit.json_call(
            self.server.base, "/alias", {"ws": ws["id"], "alias": "  我的   工程 "}
        )
        self.assertEqual(status, 200)
        self.assertEqual(self.workspace("mvn")["alias"], "我的 工程")

        nodes = [
            {"kind": "group", "id": "g1", "parent": "", "name": "分组"},
            {"kind": "ws", "id": ws["id"], "parent": "g1"},
        ]
        status, data = testkit.json_call(self.server.base, "/groups", {"nodes": nodes})
        self.assertEqual(status, 200, data)
        self.assertEqual(len(data["groups"]), 2)
        self.assertEqual(len(self.state()["groups"]), 2)

        jdk = make_jdk(self.tmp / "jdk17")
        status, _ = testkit.json_call(self.server.base, "/jdk", {"ws": ws["id"], "jdk": str(jdk)})
        self.assertEqual(status, 200)
        ws = self.workspace("mvn")
        self.assertEqual(ws["jdk"], str(jdk.resolve()))
        self.assertFalse(ws["jdk_missing"])

        status, _ = testkit.json_call(self.server.base, "/jdk", {"ws": ws["id"], "jdk": str(self.empty)})
        self.assertEqual(status, 400)

    def test_04_start_stop_mvn_with_args(self):
        self.add(self.mvn_root)
        ws = self.workspace("mvn")
        svc = self.service(ws, "run")

        jdk = make_jdk(self.tmp / "jdk-start")
        status, _ = testkit.json_call(self.server.base, "/jdk", {"ws": ws["id"], "jdk": str(jdk)})
        self.assertEqual(status, 200)

        status, _ = testkit.json_call(
            self.server.base, "/update", {"svc": svc["id"], "args": "-Dfoo=bar", "mode": "compile"}
        )
        self.assertEqual(status, 200)
        svc = self.service(self.workspace("mvn"), "run")
        self.assertEqual(svc["args"], "-Dfoo=bar")

        status, data = testkit.json_call(
            self.server.base, "/start", {"svc": svc["id"], "mode": "compile"}
        )
        self.assertEqual(status, 200, data)
        runid = data["run"]
        run = self.wait_run(ws["id"], svc["id"], ("ready",))
        self.assertEqual(run["port"], MVN_PORT)
        self.assertTrue(run["pid"])

        log_path = self.home / "logs" / ws["id"] / (runid + ".log")
        self.assertTrue(log_path.is_file(), log_path)
        text = log_path.read_text(encoding="utf-8")
        self.assertIn("-Dfoo=bar", text)
        self.assertIn("Tomcat started on port", text)
        self.assertIn("JAVA_HOME=%s" % jdk.resolve(), text)

        status, data = testkit.json_call(self.server.base, "/log", None)
        # 上面故意不带 run，返回空日志；再按运行号取一份。
        self.assertEqual(status, 200)
        status, data = testkit.json_call(
            self.server.base, "/log?run=%s" % runid, None
        )
        self.assertEqual(status, 200, data)
        self.assertIn("fake-mvn", data["text"])

        pid = int(run["pid"])
        status, _ = testkit.json_call(self.server.base, "/stop", {"run": runid})
        self.assertEqual(status, 200)
        run = self.wait_run(ws["id"], svc["id"], ("stopped",))
        self.assertEqual(run["pid"], "")
        with self.assertRaises(ProcessLookupError):
            os.killpg(pid, 0)

    def test_05_start_stop_gradle(self):
        self.add(self.gradle_root)
        ws = self.workspace("gradle")
        svc = self.service(ws, "run")

        status, _ = testkit.json_call(
            self.server.base,
            "/update",
            {"svc": svc["id"], "args": "--info", "mode": "rebuild", "refresh": True},
        )
        self.assertEqual(status, 200)
        status, data = testkit.json_call(
            self.server.base,
            "/start",
            {"svc": svc["id"], "mode": "rebuild", "refresh": True},
        )
        self.assertEqual(status, 200, data)
        runid = data["run"]
        run = self.wait_run(ws["id"], svc["id"], ("ready",))
        self.assertEqual(run["port"], GRADLE_PORT)
        text = (self.home / "logs" / ws["id"] / (runid + ".log")).read_text(encoding="utf-8")
        self.assertIn("fake-gradle", text)
        self.assertIn("--info", text)
        self.assertIn("--refresh-dependencies", text)

        status, _ = testkit.json_call(self.server.base, "/stop", {"run": runid})
        self.assertEqual(status, 200)
        self.wait_run(ws["id"], svc["id"], ("stopped",))

    def test_06_invalid_directories_rejected(self):
        status, data = testkit.json_call(
            self.server.base, "/workspaces", {"root": str(self.empty)}
        )
        self.assertEqual(status, 400, data)
        self.assertIn("不是 Maven 或 Gradle", data["error"])

        status, data = testkit.json_call(
            self.server.base, "/workspaces", {"root": str(self.both)}
        )
        self.assertEqual(status, 400, data)
        self.assertIn("无法判断", data["error"])

        status, data = testkit.json_call(
            self.server.base, "/workspaces", {"root": str(self.tmp / "missing")}
        )
        self.assertEqual(status, 400, data)
        self.assertEqual(self.state()["workspaces"], [])

    def test_07_sse_state_metrics_and_log(self):
        self.add(self.mvn_root)
        ws = self.workspace("mvn")
        svc = self.service(ws, "run")

        state = self.read_event("/state/stream", "state")
        self.assertEqual(state["workspaces"][0]["id"], ws["id"])
        metrics = self.read_event("/state/stream", "metrics")
        self.assertIsInstance(metrics, dict)

        status, data = testkit.json_call(self.server.base, "/start", {"svc": svc["id"]})
        self.assertEqual(status, 200, data)
        runid = data["run"]
        self.wait_run(ws["id"], svc["id"], ("ready",))
        tail = self.read_event("/log/stream?run=%s" % runid, "tail")
        self.assertIn("fake-mvn", tail["text"])

        status, data = testkit.json_call(self.server.base, "/metrics")
        self.assertEqual(status, 200)
        self.assertIsInstance(data, dict)

    def test_08_cli_version_and_help(self):
        exe = REPO / "jvmx" / "bin" / "jvmx"
        done = subprocess.run([str(exe), "--version"], capture_output=True, text=True, timeout=20)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("0.1.0", done.stdout)
        done = subprocess.run([str(exe), "--help"], capture_output=True, text=True, timeout=20)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("jvmx web", done.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
