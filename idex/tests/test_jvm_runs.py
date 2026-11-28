# @Author: Himmeltala
# @Date: 2026-11-26 21:50:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 21:50:00
# @FilePath: \idex\tests\test_jvm_runs.py
# @Description: JVM 运行记录：错误摘取、历史上限与心跳判定。

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "idex" / "src" / "idex"))

from engines.jvm import runs as runs_mod
from engines.jvm.runs import MAX_RUNS, RunRegistry, error_text


class ErrorTextTest(unittest.TestCase):
    def test_first_error_line_is_trimmed(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "build.log"
            path.write_text("ok\n[ERROR] 找不到符号 Foo\n[ERROR] 第二条\n", encoding="utf-8")
            self.assertEqual(error_text(path), "找不到符号 Foo")

    def test_build_failed_line(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "build.log"
            path.write_text("BUILD FAILED in 2s\n", encoding="utf-8")
            self.assertEqual(error_text(path), "BUILD FAILED in 2s")

    def test_missing_file_or_no_error(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(error_text(Path(td) / "none.log"), "")
            path = Path(td) / "build.log"
            path.write_text("BUILD SUCCESS\n", encoding="utf-8")
            self.assertEqual(error_text(path), "")


def make_run(index, status="exited"):
    return {
        "id": "svc.%d" % index,
        "svc": "svc",
        "ws": "w1",
        "status": status,
        "started_ns": index,
        "pid": "",
        "log": "",
    }


class HistoryTrimTest(unittest.TestCase):
    def test_trim_drops_oldest_finished_and_keeps_live(self):
        with tempfile.TemporaryDirectory() as td:
            registry = RunRegistry(Path(td) / "runs.json", Path(td) / "logs")
            registry.runs = [make_run(i) for i in range(MAX_RUNS + 10)]
            registry.runs.append(make_run(0, "ready"))
            registry._trim()
            self.assertEqual(len(registry.runs), MAX_RUNS)
            ids = [run["id"] for run in registry.runs]
            self.assertIn("svc.0", ids)  # 在跑的那条留着
            self.assertNotIn("svc.10", ids)  # 最旧的已结束被丢掉


class AdvanceTest(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.home = Path(self.td.name)
        self.registry = RunRegistry(self.home / "runs.json", self.home / "logs")

    def tearDown(self):
        self.td.cleanup()

    def test_dead_process_records_exit_code(self):
        log = self.home / "run.log"
        log.write_text("done\n", encoding="utf-8")
        (self.home / "run.log.code").write_text("0", encoding="utf-8")
        self.registry.runs = [
            {
                "id": "a.1",
                "svc": "a",
                "ws": "w1",
                "status": "starting",
                "pid": "424242",
                "type": "run",
                "log": str(log),
                "started_ns": 1,
            }
        ]
        with mock.patch.object(runs_mod, "group_alive", return_value=False):
            self.assertTrue(self.registry.advance())
        run = self.registry.runs[0]
        self.assertEqual(run["status"], "exited")
        self.assertEqual(run["pid"], "")
        self.assertEqual(run["code"], "0")

    def test_loss_waits_before_marking_stopped(self):
        self.registry.runs = [
            {
                "id": "a.2",
                "svc": "a",
                "ws": "w1",
                "status": "starting",
                "pid": "424242",
                "type": "run",
                "log": str(self.home / "missing.log"),
                "started_ns": 2,
                "miss": 0,
            }
        ]
        with mock.patch.object(runs_mod, "group_alive", return_value=False):
            self.assertFalse(self.registry.advance())
            self.assertEqual(self.registry.runs[0]["miss"], 1)
            self.assertEqual(self.registry.runs[0]["status"], "starting")

    def test_stop_returns_before_reap_and_marks_stopping(self):
        self.registry.runs = [
            {
                "id": "a.4",
                "svc": "a",
                "ws": "w1",
                "tag": "demo",
                "status": "ready",
                "pid": "424242",
                "type": "run",
                "log": "",
                "started_ns": 4,
            }
        ]
        calls = []
        import threading as _threading

        gate = _threading.Event()
        done = _threading.Event()

        # 卡住回收线程，先看「停止中」这个中间态，再放它收尾。
        def fake_stop_after_kill(pid, grace=0):
            calls.append(pid)
            gate.wait(2)
            done.set()

        with mock.patch.object(self.registry.sessions, "kill_group", side_effect=fake_stop_after_kill):
            self.assertTrue(self.registry.stop("a.4"))
            self.assertEqual(self.registry.find("a.4")["status"], "stopping")
            self.assertIsNotNone(self.registry.stopping_for("w1", "demo"))
            gate.set()
            done.wait(2)
            self.assertTrue(self.registry.wait_stopped("a.4", timeout=2))
        self.assertEqual(self.registry.find("a.4")["status"], "stopped")
        self.assertEqual(calls, ["424242"])

    def test_advance_leaves_stopping_alone(self):
        self.registry.runs = [
            {
                "id": "a.5",
                "svc": "a",
                "ws": "w1",
                "status": "stopping",
                "pid": "",
                "type": "run",
                "log": "",
                "started_ns": 5,
            }
        ]
        self.assertFalse(self.registry.advance())
        self.assertEqual(self.registry.runs[0]["status"], "stopping")

    def test_save_is_compact(self):
        self.registry.runs = [make_run(1)]
        self.registry._save()
        text = (self.home / "runs.json").read_text(encoding="utf-8")
        self.assertNotIn("\n", text)
        self.assertEqual(len(text.splitlines()), 1)

    def test_alive_starting_finds_port(self):
        log = self.home / "server.log"
        log.write_text("Tomcat started on port(s): 8080 (http)\n", encoding="utf-8")
        self.registry.runs = [
            {
                "id": "a.3",
                "svc": "a",
                "ws": "w1",
                "status": "starting",
                "pid": "424242",
                "type": "run",
                "log": str(log),
                "started_ns": 3,
            }
        ]
        with mock.patch.object(runs_mod, "group_alive", return_value=True):
            self.assertTrue(self.registry.advance())
        self.assertEqual(self.registry.runs[0]["status"], "ready")
        self.assertEqual(self.registry.runs[0]["port"], "8080")


if __name__ == "__main__":
    unittest.main()
