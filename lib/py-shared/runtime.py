"""网页进程的启动骨架：检查打包目录、起监听、打印就绪行与信号处理。

nodex 与 mvnx 的 ``server.py`` 只组装状态、引擎与 Handler，起服务的骨架走这里。
"""

import signal
import threading
import webbrowser
from pathlib import Path

from web import WebServer, guess_host, is_any, log


def check_static(path):
    """页面目录必须已经打包；缺 index.html 时打一行日志并返回 None。"""
    static = Path(path).resolve()
    if not (static / "index.html").is_file():
        log("缺 %s/index.html，前端还没打包" % static)
        return None
    return static


def start_streams(*streams):
    """状态与指标各一条后台线程，页面开几个都共用这一份。"""
    for stream in streams:
        stream.start()


def serve(handler, host, port, ready=None, title=None, open_browser=False):
    """绑定端口并一直服务；ready 是给 bash 认的就绪行前缀。"""
    try:
        httpd = WebServer((host, port), handler)
    except OSError as exc:
        log("端口 %s 用不了：%s" % (port, exc))
        return 1
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    addr = guess_host() if is_any(host) else host
    url = "http://%s:%d/" % (addr, port)

    # 端口填 0 时这里报的是真正用上的那个，bash 守着这一行等它就绪。
    if ready:
        print("%s %s:%d" % (ready, addr, port), flush=True)
    if title:
        log("%s：%s" % (title, url))

    def shutdown(signum, frame):
        log("收到信号 %d，退出" % signum)
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    if open_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
    return 0
