"""事件解析与 flow 归并：fd 复用、IPv6、未知字节与超时。"""

import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx import events
from netx.db import Database
from netx.tracker import FlowTracker


class EventsTest(unittest.TestCase):
    def test_parse_ipv4_connect(self):
        ev = events.parse("C\t100\t1000\t5\t4\tf39342ac\t443\tcurl")
        self.assertEqual(ev["type"], "connect")
        self.assertEqual(ev["pid"], 100)
        self.assertEqual(ev["fd"], 5)
        self.assertEqual(ev["ip"], "172.66.147.243")
        self.assertEqual(ev["port"], 443)

    def test_parse_ipv6_connect(self):
        ev = events.parse(
            "C\t100\t1000\t5\t6\tb80d0120:00000000:00000000:01000000\t443\tcurl"
        )
        self.assertEqual(ev["ip"], "2001:db8::1")

    def test_parse_bytes_and_close(self):
        self.assertEqual(
            events.parse("B\t100\t5\t42"),
            {"type": "bytes", "pid": 100, "fd": 5, "delta": 42},
        )
        self.assertEqual(
            events.parse("K\t100\t5"), {"type": "close", "pid": 100, "fd": 5}
        )

    def test_parse_unconnected_udp(self):
        ev = events.parse("U\t100\t5\t4\tfeffff0a\t53\t20\tpython3")
        self.assertEqual(ev["type"], "udp")
        self.assertEqual(ev["ip"], "10.255.255.254")
        self.assertEqual(ev["port"], 53)
        self.assertEqual(ev["delta"], 20)

        ev6 = events.parse("U\t100\t5\t6\tb80d0120:00000000:00000000:01000000\t53\t20\tpython3")
        self.assertEqual(ev6["ip"], "2001:db8::1")

    def test_parse_exit(self):
        self.assertEqual(
            events.parse("E\t100\t101"), {"type": "exit", "pid": 100, "tid": 101}
        )

    def test_parse_bad_lines(self):
        self.assertIsNone(events.parse("Attaching 4 probes..."))
        self.assertIsNone(events.parse("C\t1\t2"))
        self.assertIsNone(events.parse("C\t1\t2\t3\t9\t0\t1\tx"))

    def test_parse_map_line(self):
        self.assertEqual(
            events.parse_map_line("@bytes[100, 5]: 88"),
            {"type": "bytes", "pid": 100, "fd": 5, "delta": 88},
        )
        self.assertIsNone(events.parse_map_line("@bytes[100, 5]: 0"))


class TrackerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Database(Path(self.tmp.name) / "netx.db").init()
        self.now = 1000.0
        self.alive = False
        self.tracker = FlowTracker(
            self.db,
            clock=lambda: self.now,
            idle=300,
            proc_info=lambda pid: {"comm": "curl", "exe": "/usr/bin/curl", "uid": 1000},
            pid_alive=lambda pid: self.alive,
        )

    def _connect(self, pid=100, fd=5, port=443):
        self.tracker.on_event(
            {
                "type": "connect",
                "pid": pid,
                "uid": 1000,
                "fd": fd,
                "family": 4,
                "ip": "93.184.216.34",
                "port": port,
                "comm": "curl",
            }
        )

    def _bytes(self, delta, pid=100, fd=5):
        self.tracker.on_event({"type": "bytes", "pid": pid, "fd": fd, "delta": delta})

    def test_bytes_and_close(self):
        self._connect()
        self._bytes(120)
        self._bytes(80)
        self.tracker.on_event({"type": "close", "pid": 100, "fd": 5})

        row = self.db.flows(minutes=None)[0]
        self.assertEqual(row["bytes_out"], 200)
        self.assertEqual(row["comm"], "curl")
        self.assertEqual(row["exe"], "/usr/bin/curl")
        self.assertIsNotNone(row["ended"])

    def test_fd_reuse_ends_previous_flow(self):
        self._connect()
        self._bytes(10)
        self.now += 5
        self._connect(port=80)

        rows = self.db.flows(minutes=None)
        self.assertEqual(len(rows), 2)
        closed = [row for row in rows if row["ended"] is not None]
        opened = [row for row in rows if row["ended"] is None]
        self.assertEqual(len(closed), 1)
        self.assertEqual(len(opened), 1)
        self.assertEqual(closed[0]["bytes_out"], 10)
        self.assertEqual(opened[0]["dst_port"], 80)

    def test_bytes_without_connect_ignored(self):
        self._bytes(50)
        self.assertEqual(self.db.count_flows(), 0)

    def test_process_exit_waits_for_final_bytes(self):
        self._connect(fd=5)
        self._connect(fd=6, port=80)
        self.tracker.on_event({"type": "exit", "pid": 100, "tid": 100})
        rows = self.db.flows(minutes=None)
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["ended"] is None for row in rows))

        # 退出前最后一批字节要记上，确认进程真没了再收尾。
        self._bytes(30, fd=5)
        rows = {row["dst_port"]: row for row in self.db.flows(minutes=None)}
        self.assertEqual(rows[443]["bytes_out"], 30)
        self.assertIsNone(rows[443]["ended"])

        self.now += 4
        self.tracker.tick()
        rows = self.db.flows(minutes=None)
        self.assertTrue(all(row["ended"] is not None for row in rows))

    def test_unconnected_udp_flows(self):
        udp = {
            "type": "udp",
            "pid": 100,
            "fd": 5,
            "family": 4,
            "ip": "10.255.255.254",
            "port": 53,
            "delta": 20,
        }
        self.tracker.on_event(dict(udp))
        self.tracker.on_event(dict(udp, delta=30))
        rows = self.db.flows(minutes=None)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["bytes_out"], 50)

        self.tracker.on_event(dict(udp, ip="93.184.216.34", port=443, delta=40))
        rows = self.db.flows(minutes=None)
        self.assertEqual(len(rows), 2)
        old = [row for row in rows if row["dst_port"] == 53][0]
        self.assertIsNotNone(old["ended"])

        self.tracker.on_event({"type": "close", "pid": 100, "fd": 5})
        rows = self.db.flows(minutes=None)
        self.assertTrue(all(row["ended"] is not None for row in rows))

    def test_thread_exit_keeps_flows_open(self):
        self.alive = True
        self._connect(fd=5)
        self.tracker.on_event({"type": "exit", "pid": 100, "tid": 101})
        self.now += 4
        self.tracker.tick()
        self.assertIsNone(self.db.flows(minutes=None)[0]["ended"])
        # 线程退了，进程还在，后续字节照样记。
        self._bytes(40, fd=5)
        self.assertEqual(self.db.flows(minutes=None)[0]["bytes_out"], 40)

    def test_pid_reuse_starts_a_new_flow(self):
        self._connect(fd=5)
        self.tracker.on_event({"type": "exit", "pid": 100, "tid": 100})
        self.now += 1
        self._connect(fd=5, port=80)
        self.now += 4
        self.tracker.tick()
        rows = self.db.flows(minutes=None)
        old = [row for row in rows if row["dst_port"] == 443][0]
        new = [row for row in rows if row["dst_port"] == 80][0]
        self.assertIsNotNone(old["ended"])
        self.assertIsNone(new["ended"])

    def test_tick_expires_idle_flow(self):
        self._connect()
        self.now += 400
        self.tracker.tick()
        row = self.db.flows(minutes=None)[0]
        self.assertIsNotNone(row["ended"])


if __name__ == "__main__":
    unittest.main()
