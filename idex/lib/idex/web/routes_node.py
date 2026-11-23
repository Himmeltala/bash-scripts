"""Node 引擎的接口：状态、版本、启停、重扫与自定义命令。

只做参数、工作区映射、权限与调用；状态与执行端都在 NodeService 里。
"""

import threading

from browse import list_dirs
from engines.node.engine import current_node_version, discover_nodes
from web import ApiError, STREAMED, log

# 这些路由要写状态文件或动进程，POST 之外的方法一律不接。
_WRITE_ROUTES = ("start", "stop", "update", "rescan", "addcmd", "delcmd", "node")


class NodeRoutes:
    """路由表里 /node 一组接口的实现，靠 MRO 混进 Handler。"""

    node_service = None

    # 同一个工作区的重扫正在排队或跑着；Handler 每个请求一个新实例，所以放类上。
    _rescan_lock = threading.Lock()
    _rescanning = set()

    def _node_ws(self, wid):
        """idex 工作区 id → Node 引擎工作区 id；没登记 Node 的不让动。"""
        tools = self.store.tools(wid) if wid else {}
        node = tools.get("node") if isinstance(tools, dict) else None
        engine_id = str((node or {}).get("id") or "").strip()
        if not engine_id:
            raise ApiError(409, "这个工作区没有登记 Node 引擎")
        return engine_id

    def _node_dispatch(self, method, route, query, body):
        if route == "state":
            return self.node_service.state_payload()
        if route == "nodes":
            return {"nodes": discover_nodes(), "current": current_node_version()}
        if route == "log":
            return self.node_service.log_page(query)
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
        """重扫一个工作区：登记过 Node 的按引擎 id 扫，没扫描过的按根目录登记。

        扫描要几秒，放守护线程里做；同一工作区同时只允许一条。
        """
        tools = self.store.tools(wid) if wid else {}
        node = tools.get("node") if isinstance(tools, dict) else None
        if not isinstance(node, dict):
            raise ApiError(409, "这个工作区没有登记 Node")
        engine_id = str(node.get("id") or "").strip()
        root = str(node.get("root") or "").strip()
        if not engine_id and not root:
            raise ApiError(409, "这个工作区没有登记 Node")

        with self._rescan_lock:
            if wid in self._rescanning:
                raise ApiError(409, "这个工作区正在重扫")
            self._rescanning.add(wid)

        def run():
            try:
                if engine_id:
                    self.node_service.rescan(engine_id)
                else:
                    self.node_service.add_workspace(root)
            except ApiError as exc:
                log("重扫 Node 工作区失败：%s" % exc.message)
            except Exception as exc:
                log("重扫 Node 工作区出错：%r" % exc)
            finally:
                with self._rescan_lock:
                    self._rescanning.discard(wid)

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}

    def _node_log_stream(self, query):
        """日志流按 NodeService 的日志目录走；Engine 的日志就在这底下。"""
        self.logs = str(self.node_service.logs)
        self._stream_log((query.get("run") or [""])[0])
