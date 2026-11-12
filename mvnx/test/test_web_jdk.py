"""网页模式按工作区选 JDK 的回归测试。

直接加载 lib/mvnx/web/server.py，只测扫描、存储与环境拼装这几块纯逻辑；
接口与实际起进程由手工验证。
"""

import importlib.util
import os
import tempfile
import time
import unittest
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2] / "mvnx" / "lib" / "mvnx" / "web" / "server.py"

spec = importlib.util.spec_from_file_location("mvnx_web_server", SERVER)
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


def make_jdk(root, name, version="17.0.9", vendor="Test"):
    """造一个最小的 JDK 目录：bin/java、bin/javac 与 release。"""
    home = Path(root) / name
    (home / "bin").mkdir(parents=True)
    (home / "bin" / "java").write_text("#!/bin/sh\n")
    (home / "bin" / "javac").write_text("#!/bin/sh\n")
    (home / "release").write_text(
        'JAVA_VERSION="%s"\nIMPLEMENTOR="%s"\n' % (version, vendor)
    )
    return home


class DiscoverTest(unittest.TestCase):
    def test_lists_only_jdk_homes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            home = make_jdk(root, "17.0.9")
            (root / "not-a-jdk" / "bin").mkdir(parents=True)
            items = web.discover_jdks([root])
            self.assertEqual([i["path"] for i in items], [str(home.resolve())])

    def test_reads_version_and_vendor(self):
        with tempfile.TemporaryDirectory() as td:
            make_jdk(Path(td), "17.0.9", version="17.0.9", vendor="Eclipse Adoptium")
            item = web.discover_jdks([Path(td)])[0]
            self.assertEqual(item["version"], "17.0.9")
            self.assertEqual(item["vendor"], "Eclipse Adoptium")
            self.assertIn("17.0.9", item["label"])

    def test_skips_current_symlink(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            home = make_jdk(root, "8.0.504")
            os.symlink(home, root / "current")
            items = web.discover_jdks([root])
            self.assertEqual([i["path"] for i in items], [str(home.resolve())])

    def test_missing_root_is_empty(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(web.discover_jdks([Path(td) / "nope"]), [])

    def test_requires_javac(self):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td) / "jre"
            (home / "bin").mkdir(parents=True)
            (home / "bin" / "java").write_text("")
            self.assertFalse(web.is_jdk_home(home))
            self.assertTrue(web.is_jdk_home(make_jdk(td, "jdk")))


class StoreTest(unittest.TestCase):
    def test_roundtrip_survives_reload(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "jdk.tsv"
            store = web.JdkStore(path)
            store.set("ws1", "/opt/jdk 8")
            again = web.JdkStore(path)
            self.assertEqual(again.get("ws1"), "/opt/jdk 8")

    def test_remove(self):
        with tempfile.TemporaryDirectory() as td:
            store = web.JdkStore(Path(td) / "jdk.tsv")
            store.set("ws1", "/opt/jdk8")
            store.remove("ws1")
            self.assertEqual(store.get("ws1"), "")
            self.assertEqual(web.JdkStore(Path(td) / "jdk.tsv").get("ws1"), "")


class EnvTest(unittest.TestCase):
    def test_sets_java_home_and_prepends_path(self):
        base = {"PATH": "/usr/bin:/bin", "HOME": "/home/x"}
        env = web.build_env("/opt/jdk8", base=base)
        self.assertEqual(env["JAVA_HOME"], "/opt/jdk8")
        self.assertEqual(env["PATH"].split(os.pathsep)[0], "/opt/jdk8/bin")
        self.assertIn("/usr/bin", env["PATH"])
        self.assertEqual(env["HOME"], "/home/x")
        self.assertNotIn("JAVA_HOME", base)

    def test_empty_jdk_inherits_environment(self):
        self.assertIsNone(web.build_env("", base={}))

    def test_missing_jdk_falls_back(self):
        self.assertEqual(web.effective_jdk("/no/such/jdk"), "")
        with tempfile.TemporaryDirectory() as td:
            home = make_jdk(td, "jdk")
            self.assertEqual(web.effective_jdk(str(home)), str(home))


class SpawnEnvTest(unittest.TestCase):
    def test_spawn_uses_given_env(self):
        with tempfile.TemporaryDirectory() as td:
            log = Path(td) / "out.log"
            env = web.build_env("/opt/jdk8", base={"PATH": "/usr/bin:/bin"})
            web.Sessions().spawn(td, ["/bin/sh", "-c", "echo $JAVA_HOME"], log, env=env)
            code = Path(str(log) + ".code")
            for _ in range(100):
                if code.exists():
                    break
                time.sleep(0.02)
            self.assertEqual(log.read_text().strip(), "/opt/jdk8")


class SnapshotTest(unittest.TestCase):
    def test_attaches_jdk_and_marks_missing(self):
        with tempfile.TemporaryDirectory() as td:
            home = make_jdk(td, "jdk")
            store = web.JdkStore(Path(td) / "jdk.tsv")
            store.set("w1", str(home))
            store.set("w2", "/gone/jdk")
            snap = {"workspaces": [{"id": "w1"}, {"id": "w2"}, {"id": "w3"}]}
            web.attach_jdks(snap, store)
            self.assertEqual(snap["workspaces"][0]["jdk"], str(home))
            self.assertFalse(snap["workspaces"][0]["jdk_missing"])
            self.assertTrue(snap["workspaces"][1]["jdk_missing"])
            self.assertEqual(snap["workspaces"][2]["jdk"], "")
            self.assertFalse(snap["workspaces"][2]["jdk_missing"])


if __name__ == "__main__":
    unittest.main()
