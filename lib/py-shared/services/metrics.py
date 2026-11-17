# @Author: Himmeltala
# @Date: 2026-11-13 23:20:04
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-17 23:35:13
# @FilePath: \lib\py-shared\services\metrics.py
# @Description: CPU、内存、磁盘占用与网速，页面头部那几张小图用。

import os
import threading
import time
from pathlib import Path

from web import log

NET_DEV = "/proc/net/dev"
NET_ROUTE = "/proc/net/route"


def _percent(used, total):
    if not total:
        return None
    return round(100.0 * used / total, 1)


def parse_net_dev(text):
    """ /proc/net/dev 的内容 → {网卡: (收字节, 发字节)}。"""
    out = {}
    for line in text.splitlines():
        name, sep, rest = line.partition(":")
        if not sep:
            continue
        fields = rest.split()
        if len(fields) < 9:
            continue
        out[name.strip()] = (int(fields[0]), int(fields[8]))
    return out


def default_iface(text):
    """ /proc/net/route 里默认路由的网卡；有多条时取 metric 最小的。"""
    best = None
    for line in text.splitlines()[1:]:
        fields = line.split()
        if len(fields) < 8 or fields[1] != "00000000":
            continue
        try:
            cost = int(fields[6])
        except ValueError:
            continue
        if best is None or cost < best[0]:
            best = (cost, fields[0])
    return best[1] if best else ""


def net_rate(before, after, seconds):
    """两次累计计数之间的收发速率（字节/秒）；计数回落（网卡重连）按 0 算。"""
    if seconds <= 0:
        return None
    return {
        "down": int(round(max(0, after[0] - before[0]) / seconds)),
        "up": int(round(max(0, after[1] - before[1]) / seconds)),
    }


class Metrics:
    """页面头部的指标采集：CPU 首次请求采样两次、间隔 200ms；网速第一次只记基准，下一份才算得出速率。"""

    SAMPLE_PAUSE = 0.2

    def __init__(self, home=None, net_dev=NET_DEV, net_route=NET_ROUTE, clock=time.monotonic):
        self.home = Path(home) if home else Path.home()
        self.mount = self._mount_of(self.home)
        self.net_dev = net_dev
        self.net_route = net_route
        self.clock = clock
        self._lock = threading.Lock()
        self._prev = None
        self._net = None
        self._net_lock = threading.Lock()

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

    @staticmethod
    def _read(path):
        with open(path, "r") as fh:
            return fh.read()

    def net(self):
        """默认出口网卡的收发速率；第一次采样没有基准，返回 None。"""
        try:
            iface = default_iface(self._read(self.net_route))
            counters = parse_net_dev(self._read(self.net_dev)).get(iface) if iface else None
        except OSError:
            return None
        now = self.clock()
        with self._net_lock:
            prev = self._net
            self._net = (iface, counters, now)
        # 换了网卡或上次没读到时，这一份只当基准，等下一次再算速率。
        if counters is None or prev is None or prev[0] != iface or prev[1] is None:
            return None
        rate = net_rate(prev[1], counters, now - prev[2])
        if rate is None:
            return None
        rate["iface"] = iface
        return rate

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
        for key in ("cpu", "mem", "disk", "net"):
            try:
                out[key] = getattr(self, key)()
            except (OSError, ValueError) as exc:
                log("取 %s 指标失败：%s" % (key, exc))
                out[key] = None
        return out
