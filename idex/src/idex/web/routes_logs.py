# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\routes_logs.py
# @Description: 页面日志接口：分页读取、前端追加与清空。

from web import ApiError


class LogRoutes:
    """日志接口的实现，靠 MRO 混进 Handler。"""

    logs = None

    def _log_store(self):
        if self.logs is None:
            raise ApiError(503, "日志存储没有起来")
        return self.logs

    def _logs_read(self, query):
        store = self._log_store()
        return store.read(
            before=(query.get("before") or [""])[0],
            limit=(query.get("limit") or ["200"])[0],
            level=(query.get("level") or [""])[0],
        )

    def _logs_add(self, body):
        self._check_write()
        store = self._log_store()
        level = str(body.get("level") or "info")
        item = store.add(
            level,
            body.get("message"),
            str(body.get("detail") or ""),
            source=str(body.get("source") or "frontend"),
        )
        if item is None:
            raise ApiError(400, "日志内容为空")
        return {"ok": True, "id": item["id"]}

    def _logs_clear(self, body):
        self._check_write()
        self._log_store().clear()
        return {"ok": True}
