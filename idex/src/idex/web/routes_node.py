# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\routes_node.py
# @Description: Node 引擎的接口：状态、版本、启停、重扫与自定义命令。

"""只做参数、工作区映射、权限与调用；状态与执行端都在 NodeService 里。"""

import threading
import time
from pathlib import Path

from browse import list_dirs
from engines.node.engine import build_artifact, current_node_version, discover_nodes, ws_root
from routes_browse import _compress_lock, _zipx_pack
from runner import run_log_path
from sse import SSEMixin
from web import ApiError, STREAMED, log

# Node 候选要扫四个目录再跑一次 `node --version`；一分钟内复用同一份，别每开页面都扫。
_NODES_TTL = 60
_nodes_cache = {"at": 0.0, "data": None}
_nodes_lock = threading.Lock()


def nodes_payload():
    now = time.time()
    with _nodes_lock:
        if _nodes_cache["data"] is not None and now - _nodes_cache["at"] < _NODES_TTL:
            return _nodes_cache["data"]
    data = {"nodes": discover_nodes(), "current": current_node_version()}
    with _nodes_lock:
        _nodes_cache["at"] = now
        _nodes_cache["data"] = data
    return data

# 这些路由要写状态文件或动进程，POST 之外的方法一律不接。
_WRITE_ROUTES = ("start", "stop", "restart", "update", "rescan", "addcmd", "delcmd", "node")


class NodeRoutes(SSEMixin):
    """路由表里 /node 一组接口的实现，靠 MRO 混进 Handler。"""

    node_service = None

    # 同一个工作区的重扫正在排队或跑着；Handler 每个请求一个新实例，所以放类上。
    _node_rescan_lock = threading.Lock()
    _node_rescanning = set()
    # 每个引擎工作区最近一次重扫失败的原因；状态回话与轮询接口都从这里取。
    _node_rescan_errors = {}

    def _node_ws(self, wid):
        """idex 工作区 id → Node 引擎工作区 id；没登记 Node 的不让动。"""
        tools = self.store.tools(wid) if wid else {}
        node = tools.get("node") if isinstance(tools, dict) else None
        engine_id = str((node or {}).get("id") or "").strip()
        if not engine_id:
            raise ApiError(409, "这个工作区没有登记 Node 引擎")
        # 探测出的 id 只说明 idex 这边的映射，引擎状态里可能还没这个工作区。
        if not self.node_service.has_workspace(engine_id):
            raise ApiError(409, "这个工作区还没在 Node 引擎登记，先启用并扫描")
        return engine_id

    def _node_rescan_target(self, wid):
        """重扫用的去重键、引擎工作区 id 与根目录；两个工作区可能指向同一引擎工作区。"""
        tools = self.store.tools(wid) if wid else {}
        node = tools.get("node") if isinstance(tools, dict) else None
        if not isinstance(node, dict):
            raise ApiError(409, "这个工作区没有登记 Node")
        engine_id = str(node.get("id") or "").strip()
        root = str(node.get("root") or "").strip()
        if not engine_id and not root:
            raise ApiError(409, "这个工作区没有登记 Node")
        return engine_id or root, engine_id, root

    def _node_rescan_status(self, wid):
        key, _engine_id, _root = self._node_rescan_target(wid)
        with self._node_rescan_lock:
            return {
                "running": key in self._node_rescanning,
                "error": self._node_rescan_errors.get(key, ""),
            }

    def _node_dispatch(self, method, route, query, body):
        if route == "state":
            payload = self.node_service.state_payload()
            with self._node_rescan_lock:
                payload["rescan_errors"] = dict(self._node_rescan_errors)
            return payload
        if route == "rescan/status":
            wid = str((query.get("ws") or [""])[0]).strip()
            return self._node_rescan_status(wid)
        if route == "runs":
            return self.node_service.runs_summary()
        if route == "download" and method in ("GET", "HEAD"):
            return self._node_download(query, head=(method == "HEAD"))
        if route == "nodes":
            return nodes_payload()
        if route == "log":
            return self._node_log_page(query)
        if route == "log/stream":
            self._node_log_stream(query)
            return STREAMED
        if route == "dirs":
            return list_dirs((query.get("path") or [""])[0])

        if route not in _WRITE_ROUTES:
            raise ApiError(404, "没有这个接口：%s" % route)
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        self._check_write()

        if route == "start":
            return self.node_service.start(body)
        if route == "stop":
            self.node_service.stop(str(body.get("run", "") or ""))
            return {"ok": True}
        if route == "restart":
            return self.node_service.restart(str(body.get("run", "") or ""))
        if route == "update":
            self.node_service.update(
                str(body.get("svc", "") or ""), str(body.get("args", "") or "")
            )
            return {"ok": True}
        if route == "rescan":
            return self._node_rescan(str(body.get("ws", "") or "").strip())
        if route == "addcmd":
            ws = self._node_ws(str(body.get("ws", "") or "").strip())
            self.node_service.add_command(
                ws,
                str(body.get("type", "") or "").strip(),
                str(body.get("rel", "") or ".").strip(),
                str(body.get("tag", "") or ""),
                str(body.get("args", "") or ""),
            )
            return {"ok": True}
        if route == "delcmd":
            self.node_service.remove_command(str(body.get("svc", "") or "").strip())
            return {"ok": True}
        if route == "node":
            ws = self._node_ws(str(body.get("ws", "") or "").strip())
            self.node_service.set_node(ws, str(body.get("node", "") or ""))
            return {"ok": True}
        raise ApiError(404, "没有这个接口：%s" % route)

    def _node_rescan(self, wid):
        """重扫工作区：有根目录就重加一次，add 幂等并会重扫；探测到的 tools.node.id 不代表引擎里已登记，直接 scan 会静默无操作。"""
        # 两个 idex 工作区可能指向同一个引擎工作区，按引擎 id/根目录去重。
        key, engine_id, root = self._node_rescan_target(wid)

        with self._node_rescan_lock:
            if key in self._node_rescanning:
                raise ApiError(409, "这个工作区正在重扫")
            self._node_rescanning.add(key)
            self._node_rescan_errors.pop(key, None)

        def run():
            try:
                if root:
                    self.node_service.add_workspace(root)
                else:
                    self.node_service.rescan(engine_id)
            except ApiError as exc:
                message = "扫描失败：%s" % exc.message
                with self._node_rescan_lock:
                    self._node_rescan_errors[key] = message
                log("重扫 Node 工作区失败：%s" % exc.message)
            except Exception as exc:
                message = "扫描出错：%r" % exc
                with self._node_rescan_lock:
                    self._node_rescan_errors[key] = message
                log("重扫 Node 工作区出错：%r" % exc)
            else:
                with self._node_rescan_lock:
                    self._node_rescan_errors.pop(key, None)
            finally:
                with self._node_rescan_lock:
                    self._node_rescanning.discard(key)

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}

    def _node_log_path(self, runid):
        """运行号只能落在 NodeService 的日志目录里，防止 ../ 读到别处的 *.log。"""
        try:
            logs = Path(self.node_service.logs).resolve()
            path = run_log_path(logs, runid)
            path.resolve().relative_to(logs)
        except ValueError:
            raise ApiError(400, "运行号不对")
        except (OSError, RuntimeError) as exc:
            # 符号链接成环时 resolve 抛 RuntimeError，按路径不对处理。
            raise ApiError(400, "日志路径读不了：%s" % exc)
        return path

    def _node_download(self, query, head=False):
        """打包产物：把 dist 用 zipx 压成 zip，缓存里已有新于 dist 的就直接下发。"""
        runid = str((query.get("run") or [""])[0]).strip()
        info = self.node_service.run_info(runid)
        dist = build_artifact(info)
        if dist is None:
            raise ApiError(404, "这个运行没有可下载的安装包")
        root = ws_root(self.node_service.state, info.get("ws", ""))
        try:
            dist = dist.resolve()
            dist.relative_to(root.resolve())
        except (OSError, ValueError):
            raise ApiError(400, "打包目录不在工作区里")
        name = "%s.zip" % (info.get("tag") or dist.parent.name or "dist")
        archive = self.node_service.home / "artifacts" / (str(runid) + ".zip")
        with _compress_lock(str(archive)):
            fresh = False
            try:
                fresh = archive.is_file() and archive.stat().st_mtime >= dist.stat().st_mtime
            except OSError:
                fresh = False
            if not fresh:
                archive.parent.mkdir(parents=True, exist_ok=True)
                _zipx_pack(str(dist), str(archive))
        self._prune_artifacts(archive.parent)
        self._send_download(archive, name, head=head)
        return STREAMED

    # 产物缓存只留一段：每次打包顺带清理超过七天的旧包，缓存目录不会一直涨。
    ARTIFACT_KEEP_SECONDS = 7 * 24 * 3600

    def _prune_artifacts(self, directory):
        cutoff = time.time() - self.ARTIFACT_KEEP_SECONDS
        try:
            entries = list(Path(directory).iterdir())
        except OSError:
            return
        for entry in entries:
            try:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    entry.unlink()
            except OSError:
                pass

    def _node_log_page(self, query):
        """日志分页仍由 NodeService 拼状态；先确认运行号没跳出日志目录。"""
        self._node_log_path((query.get("run") or [""])[0])
        return self.node_service.log_page(query)

    def _node_log_stream(self, query):
        """日志流按 NodeService 的日志目录走；Engine 的日志就在这底下。"""
        self.logs = str(self.node_service.logs)
        self._stream_log((query.get("run") or [""])[0])
