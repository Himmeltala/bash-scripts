"""CPU、内存、磁盘占用，页面头部那三张小图用。

只用 /proc 与 statvfs，不引第三方库。
"""

import os
import threading
import time
from pathlib import Path

from web import log


def _percent(used, total):
    if not total:
        return None
    return round(100.0 * used / total, 1)


class Metrics:
    """CPU 占用只有两次采样之间才算得出来：

    第一次请求时先取一次、等 200ms 再取一次，之后每次请求都用上一次留下的计数器，
    间隔就是页面的刷新周期。
    """

    SAMPLE_PAUSE = 0.2

    def __init__(self, home=None):
        self.home = Path(home) if home else Path.home()
        self.mount = self._mount_of(self.home)
        self._lock = threading.Lock()
        self._prev = None

    @staticmethod
    def _counters():
        with open("/proc/stat", "r") as fh:
            parts = fh.readline().split()[1:]
        nums = [int(x) for x in parts]
        # 空闲算 idle 加 iowait，其余（user、system、irq 等）都算忙。
        idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
        return idle, sum(nums)

    @staticmethod
    def _mount_of(path):
        target = str(path.resolve())
        best = "/"
        try:
            with open("/proc/mounts", "r") as fh:
                for line in fh:
                    fields = line.split()
                    if len(fields) < 2:
                        continue
                    point = fields[1]
                    prefix = point.rstrip("/") + "/"
                    if target == point or target.startswith(prefix):
                        if len(point) > len(best):
                            best = point
        except OSError:
            pass
        return best

    def cpu(self):
        with self._lock:
            prev = self._prev
            cur = self._counters()
            if prev is None:
                time.sleep(self.SAMPLE_PAUSE)
                prev, cur = cur, self._counters()
            self._prev = cur
        idle, total = cur[0] - prev[0], cur[1] - prev[1]
        if total <= 0:
            return None
        return round(min(100.0, max(0.0, 100.0 * (total - idle) / total)), 1)

    def mem(self):
        info = {}
        with open("/proc/meminfo", "r") as fh:
            for line in fh:
                key, _, rest = line.partition(":")
                fields = rest.split()
                if key and fields:
                    info[key] = int(fields[0]) * 1024
        total = info.get("MemTotal", 0)
        avail = info.get("MemAvailable")
        if avail is None:  # 老内核没有 MemAvailable，退回三项相加
            avail = info.get("MemFree", 0) + info.get("Buffers", 0) + info.get("Cached", 0)
        used = max(0, total - avail)
        return {"used": used, "total": total, "percent": _percent(used, total)}

    def disk(self):
        st = os.statvfs(str(self.home))
        total = st.f_frsize * st.f_blocks
        free = st.f_frsize * st.f_bfree
        avail = st.f_frsize * st.f_bavail
        used = max(0, total - free)
        return {
            "used": used,
            "total": total,
            "avail": avail,
            "percent": _percent(used, total),
            "mount": self.mount,
        }

    def snapshot(self):
        out = {"time": int(time.time())}
        for key in ("cpu", "mem", "disk"):
            try:
                out[key] = getattr(self, key)()
            except (OSError, ValueError) as exc:
                log("取 %s 指标失败：%s" % (key, exc))
                out[key] = None
        return out
