"""真实探针联调：需要 root 与 bpftrace，普通测试时跳过。

用本地回环连接发固定字节，验证 connect、发送字节与 close 三个探针确实在工作。
"""

import os
import shutil
import socket
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx.collector import Collector
from netx.db import Database
from netx.tracker import FlowTracker


@unittest.skipUnless(os.geteuid() == 0, "真实探针需要 root")
@unittest.skipUnless(shutil.which("bpftrace"), "没有 bpftrace")
class LiveTest(unittest.TestCase):
    def test_tcp_bytes_and_close(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        db = Database(Path(tmp.name) / "netx.db").init()
        tracker = FlowTracker(db)
        collector = Collector(
            db,
            tracker,
            log_file=Path(tmp.name) / "collector.log",
            restart_delay=0.2,
        )
        collector.start()
        self.addCleanup(collector.stop)
        # bpftrace 编译并挂探针要一秒左右，起完再等一会再发流量。
        time.sleep(2.0)

        server = socket.socket()
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        port = server.getsockname()[1]
        self.addCleanup(server.close)

        def accept():
            conn, _ = server.accept()
            while conn.recv(65536):
                pass
            conn.close()

        thread = threading.Thread(target=accept, daemon=True)
        thread.start()

        client = socket.create_connection(("127.0.0.1", port), timeout=5)
        client.sendall(b"q" * 1234)
        time.sleep(0.2)
        client.close()

        deadline = time.time() + 15
        row = None
        while time.time() < deadline:
            rows = [item for item in db.flows(minutes=None) if item["dst_port"] == port]
            if rows and rows[0]["ended"] is not None:
                row = rows[0]
                break
            time.sleep(0.2)

        self.assertIsNotNone(row, "15 秒内没有记录到回环连接")
        self.assertEqual(row["bytes_out"], 1234)
        self.assertEqual(row["dst_ip"], "127.0.0.1")


if __name__ == "__main__":
    unittest.main()
