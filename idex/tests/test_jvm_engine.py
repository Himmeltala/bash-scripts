import sys, tempfile, unittest
from pathlib import Path

sys.path[:0] = [
    str(Path(__file__).resolve().parents[1] / "src" / "idex"),
    str(Path(__file__).resolve().parents[2] / "lib" / "py-shared" / "commons"),
    str(Path(__file__).resolve().parents[2] / "lib" / "py-shared" / "services"),
]
from engines.jvm.engine import App

# 原来 jvmx 网页用例里的启停、JDK 与扫描，改成直接调 App，不经过 HTTP。
import json
import os
import shutil

import testkit
from web import ApiError

MVN_PORT = "18080"
GRADLE_PORT = "18081"


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


class JvmEngineTest(unittest.TestCase):
    def test_app_builds_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = App(Path(tmp))
            self.assertEqual(app.store.path.name, "state.json")
            app.close()


class JvmEngineServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="idex-jvm-"))
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
        shutil.rmtree(str(cls.tmp), ignore_errors=True)

    def setUp(self):
        self.home = Path(tempfile.mkdtemp(dir=str(self.tmp), prefix="home-"))
        self.app = App(self.home, jdk_roots=())
        self.app.start_background()

    def tearDown(self):
        for run in self.app.runs.snapshot():
            if run.get("status") in ("starting", "ready"):
                try:
                    self.app.runs.stop(run["id"])
                except Exception:
                    self.app.runs.sessions.kill_group(run.get("pid", ""))
        self.app.close()

    # 小工具

    def add(self, root):
        return self.app.add_workspace(str(root))

    def state(self):
        return self.app.state_payload()

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

    # 用例

    def test_add_mvn_workspace(self):
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

        self.assertEqual(self.app.scan(ws["id"]), "")

    def test_add_gradle_workspace(self):
        self.add(self.gradle_root)
        ws = self.workspace("gradle")
        self.assertEqual(ws["kind"], "gradle")
        self.assertEqual(sorted(svc["type"] for svc in ws["services"]), ["build", "run"])
        self.assertEqual(ws["poms"], [])
        self.assertEqual(self.service(ws, "run")["cmd"], "gradle bootRun")

    def test_alias_groups_and_jdk(self):
        self.add(self.mvn_root)
        ws = self.workspace("mvn")

        self.app.store.set_alias(ws["id"], "  我的   工程 ")
        self.assertEqual(self.workspace("mvn")["alias"], "我的 工程")

        nodes = [
            {"kind": "group", "id": "g1", "parent": "", "name": "分组"},
            {"kind": "ws", "id": ws["id"], "parent": "g1"},
        ]
        self.app.groups.set(nodes)
        self.assertEqual(len(self.app.groups.nodes()), 2)
        self.assertEqual(len(self.state()["groups"]), 2)

        jdk = make_jdk(self.tmp / "jdk17")
        self.app.set_jdk(ws["id"], str(jdk))
        ws = self.workspace("mvn")
        self.assertEqual(ws["jdk"], str(jdk.resolve()))
        self.assertFalse(ws["jdk_missing"])

        with self.assertRaises(ApiError) as caught:
            self.app.set_jdk(ws["id"], str(self.empty))
        self.assertEqual(caught.exception.status, 400)

    def test_start_stop_mvn_with_args(self):
        self.add(self.mvn_root)
        ws = self.workspace("mvn")
        svc = self.service(ws, "run")

        jdk = make_jdk(self.tmp / "jdk-start")
        self.app.set_jdk(ws["id"], str(jdk))

        self.app.update_service({"svc": svc["id"], "args": "-Dfoo=bar", "mode": "compile"})
        svc = self.service(self.workspace("mvn"), "run")
        self.assertEqual(svc["args"], "-Dfoo=bar")

        data = self.app.start_service({"svc": svc["id"], "mode": "compile"})
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

        pid = int(run["pid"])
        self.app.stop_service(runid)
        run = self.wait_run(ws["id"], svc["id"], ("stopped",))
        self.assertEqual(run["pid"], "")
        with self.assertRaises(ProcessLookupError):
            os.killpg(pid, 0)

    def test_start_stop_gradle(self):
        self.add(self.gradle_root)
        ws = self.workspace("gradle")
        svc = self.service(ws, "run")

        self.app.update_service(
            {"svc": svc["id"], "args": "--info", "mode": "rebuild", "refresh": True}
        )
        data = self.app.start_service({"svc": svc["id"], "mode": "rebuild", "refresh": True})
        runid = data["run"]
        run = self.wait_run(ws["id"], svc["id"], ("ready",))
        self.assertEqual(run["port"], GRADLE_PORT)
        text = (self.home / "logs" / ws["id"] / (runid + ".log")).read_text(encoding="utf-8")
        self.assertIn("fake-gradle", text)
        self.assertIn("--info", text)
        self.assertIn("--refresh-dependencies", text)

        self.app.stop_service(runid)
        self.wait_run(ws["id"], svc["id"], ("stopped",))

    def test_invalid_directories_rejected(self):
        with self.assertRaises(ApiError) as caught:
            self.add(self.empty)
        self.assertEqual(caught.exception.status, 400)
        self.assertIn("不是 Maven 或 Gradle", caught.exception.message)

        with self.assertRaises(ApiError) as caught:
            self.add(self.both)
        self.assertEqual(caught.exception.status, 400)
        self.assertIn("无法判断", caught.exception.message)

        with self.assertRaises(ApiError) as caught:
            self.add(self.tmp / "missing")
        self.assertEqual(caught.exception.status, 400)
        self.assertEqual(self.state()["workspaces"], [])


if __name__ == "__main__":
    unittest.main()
