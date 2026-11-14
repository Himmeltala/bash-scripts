"""nodex 与 mvnx 共用的网页接口骨架：状态、日志、指标、别名与启停的公共路由。

各工具的 ``Handler`` 继承 ``ToolHandler``，只补自己的接口：
``build_state`` 拼状态回话，``_tool_get`` / ``_tool_post`` 接工具独有的路由，
``_tool_update_args`` 给出 update 请求要带的字段。
"""

from browse import list_dirs
from sse import SSEMixin, log_page
from web import ApiError, STREAMED, WebHandler, log

# 工作区状态行的类型，与各工具 server.sh 里的 web_col 一致。
WS_KIND = "ws"
# 工具独有的路由没接住时返回它，公共流程继续往下走。
NOT_HANDLED = object()


class ToolHandler(SSEMixin, WebHandler):
    """页面与接口的公共部分；子类给 api_prefix 与上面那几个钩子。"""

    static = None
    state = None
    sessions = None
    engine = None
    aliases = None
    logs = None
    state_stream = None
    metrics_stream = None
    metrics = None
    # 工作区到工具链目录的映射（Node、JDK），移出工作区时一并清掉。
    home_store = None
    run_kind = "run"
    api_prefix = "/__tool/api"

    def build_state(self):
        """页面要的整份状态，由各工具拼。"""
        raise NotImplementedError

    def _tool_get(self, route, query, method):
        """工具独有的 GET 路由；没接住返回 NOT_HANDLED。"""
        return NOT_HANDLED

    def _tool_post(self, route, body):
        """工具独有的 POST 路由；没接住返回 NOT_HANDLED。"""
        return NOT_HANDLED

    def _tool_update_args(self, body):
        """update 请求要带的字段，由各工具给。"""
        raise NotImplementedError

    def _dispatch(self, method, route, query, body):
        if route == "log/stream":
            self._stream_log((query.get("run") or [""])[0])
            return STREAMED
        if route == "state/stream":
            self._sse([(self.state_stream, "state"), (self.metrics_stream, "metrics")])
            return STREAMED
        if route == "state":
            # 没用推送的客户端照样能拿到收拾过的状态。
            try:
                self.engine.call("tick")
            except ApiError as exc:
                log("tick 失败：%s" % exc.message)
            return self.build_state()
        if route == "log":
            return log_page(self.state, self.logs, query, self.run_kind)
        if route == "dirs":
            return list_dirs((query.get("path") or [""])[0])
        if route == "metrics/stream":
            self._sse([(self.metrics_stream, "metrics")])
            return STREAMED
        if route == "metrics":
            return self.metrics.snapshot()

        result = self._tool_get(route, query, method)
        if result is not NOT_HANDLED:
            return result
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")

        engine = self.engine
        if route == "workspaces":
            root = str(body.get("root", "")).strip()
            if not root:
                raise ApiError(400, "没给目录")
            engine.add_workspace(root)
            return {"ok": True}
        if route == "rescan":
            engine.call("scan", str(body.get("ws", "")))
            return {"ok": True}
        if route == "forget":
            ws = str(body.get("ws", ""))
            engine.remove_workspace(ws)
            if self.home_store is not None:
                self.home_store.remove(ws)
            if self.aliases is not None:
                self.aliases.set(ws, "")
            return {"ok": True}
        if route == "alias":
            ws = str(body.get("ws", "")).strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            self.aliases.set(ws, str(body.get("alias", "")))
            return {"ok": True}
        if route == "start":
            return engine.start(body)
        if route == "stop":
            engine.stop(str(body.get("run", "")))
            return {"ok": True}
        if route == "update":
            engine.call("update", *self._tool_update_args(body))
            return {"ok": True}

        result = self._tool_post(route, body)
        if result is not NOT_HANDLED:
            return result
        raise ApiError(404, "没有这个接口：%s" % route)
