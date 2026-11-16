"""jvmx 命令行：只提供网页入口。

jvmx 没有终端业务，目标发现与执行分别由 mvnx / gradlex 负责；不带参数时直接起网页。
"""

import argparse
import json
import os
import sys
import threading
import webbrowser
from pathlib import Path

import netutil
from runtime import check_static
from web import WebServer

from . import VERSION
from .app import App

USAGE = """用法: jvmx [web] [选项]

起 jvmx 网页：左侧登记 Maven / Gradle 工作区，右侧启停、看日志与指标。
不带参数等价于 jvmx web：jvmx 只有网页这一个用途，终端请用 mvnx / gradlex。

选项:
  --host 地址      监听地址，默认 0.0.0.0，同一网络里的机器都能开；只想本机用 --host 127.0.0.1
  -p, --port 端口  监听端口，默认 8300
  -o, --open       起来后打开默认浏览器
      --json       只打一行 {"url":…,"local":…,"host":…,"port":…}，给脚本起服务用
      --allow-write 允许其他机器发起写操作，默认只认本机
  -h, --help       显示本帮助
  -V, --version    显示版本
"""

WEB_USAGE = USAGE


def cache_home():
    """网页状态目录：默认 ~/.cache/jvmx/web，环境变量可覆盖（测试用）。"""
    if os.environ.get("JVMX_CACHE_HOME"):
        return Path(os.environ["JVMX_CACHE_HOME"])
    base = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base) / "jvmx" / "web"


def static_dir():
    return Path(__file__).resolve().parent / "web" / "static"


def _parse_web_args(argv):
    parser = argparse.ArgumentParser(prog="jvmx web", add_help=False)
    parser.add_argument("-h", "--help", action="store_true")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("-p", "--port", type=int, default=8300)
    parser.add_argument("-o", "--open", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--allow-write", action="store_true")
    try:
        return parser.parse_args(argv)
    except SystemExit:
        return None


def _open_browser(url):
    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001 - 打不开浏览器不影响服务本身
        pass


def cmd_web(argv):
    opts = _parse_web_args(argv)
    if opts is None:
        return 2
    if opts.help:
        print(WEB_USAGE)
        return 0
    if not 0 <= opts.port <= 65535:
        print("jvmx: --port 取 0 到 65535", file=sys.stderr)
        return 2
    try:
        host = netutil.parse_host(opts.host)
    except ValueError as exc:
        print("jvmx: %s" % exc, file=sys.stderr)
        return 2

    static = check_static(static_dir())
    if static is None:
        print("jvmx: 前端还没打包，先执行 npm --prefix jvmx/web run build", file=sys.stderr)
        return 3

    home = cache_home()
    app = App(home, static=static, allow_write=opts.allow_write)
    app.start_background()
    try:
        httpd = WebServer((host, opts.port), app.make_handler())
    except OSError as exc:
        print("jvmx: 监听 %s:%s 失败：%s" % (host, opts.port, exc), file=sys.stderr)
        app.close()
        return 1

    port = httpd.server_address[1]
    url = netutil.host_url(host, port)
    local = netutil.host_url("127.0.0.1", port)
    if opts.json:
        print(
            json.dumps(
                {"url": url, "local": local, "host": host, "port": port},
                ensure_ascii=False,
            ),
            flush=True,
        )
    else:
        print("jvmx 网页：%s" % url)
        if url != local:
            print("本机 %s" % local)
        if not netutil.is_loopback_host(host):
            print(
                "页面没有登录，同一网络里能连上的人都能启停服务；只想本机用就加 --host 127.0.0.1",
                file=sys.stderr,
            )
            if not opts.allow_write:
                print(
                    "写操作和 JDK、目录读取默认只认本机；要放开给其他机器，加 --allow-write",
                    file=sys.stderr,
                )
        print("按 Ctrl+C 退出。", file=sys.stderr)
        sys.stdout.flush()

    if opts.open:
        threading.Timer(0.5, _open_browser, args=(url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        app.close()
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        return cmd_web([])
    first = argv[0]
    if first in ("-h", "--help", "help"):
        print(USAGE)
        return 0
    if first in ("-V", "--version", "version"):
        print(VERSION)
        return 0
    if first == "web":
        return cmd_web(argv[1:])
    if first.startswith("-"):
        # jvmx -p 8301 与 jvmx web -p 8301 等价。
        return cmd_web(argv)
    print("jvmx: 没有这个命令：%s" % first, file=sys.stderr)
    print(USAGE, file=sys.stderr)
    return 2
