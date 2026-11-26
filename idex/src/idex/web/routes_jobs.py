# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\routes_jobs.py
# @Description: 操作与任务的接口：起一个后台任务，查状态、查最近一次、取消。

"""操作与任务的接口：起一个后台任务，查状态、查最近一次、取消。"""

import threading

from web import ApiError

from jobs import JOBS, Job, run_job
from event_hub import HUB
from server_common import workspace_lock
from vcs_ops import operation_plan


def _job_finished(job):
    """任务收尾时通知这个工作副本上的页面刷新状态。"""
    HUB.broadcast(job.owner, "repo", {"action": job.action, "ok": job.ok})


class JobRoutes:
    """路由表里 operations 那几条的实现，靠 MRO 混进 Handler。"""

    def _start_operation(self, body):
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        # 参数不合法时先报错，别占住工作副本锁。
        plan = operation_plan(ws, body)
        lock = workspace_lock(ws["id"])
        # 同一个工作副本同时只跑一个写操作，撞上了让用户等前一个跑完。
        if not lock.acquire(blocking=False):
            raise ApiError(409, "这个工作副本正有一个操作在执行，等它跑完再试")
        try:
            job = Job(
                ws["id"],
                plan["action"],
                plan["commands"],
                plan["cwd"],
                plan["env"],
                plan["command"],
            )
            JOBS.add(job)
            threading.Thread(
                target=run_job, args=(job, lock, _job_finished), daemon=True
            ).start()
        except Exception:
            lock.release()
            raise
        return {"ok": True, "id": job.id, "action": job.action, "command": job.command}

    def _job_json(self, job_id):
        job = JOBS.get(job_id)
        if job is None:
            raise ApiError(404, "没有这个任务")
        return job.snapshot()

    def _latest_job(self, query):
        ws = self._ws(query)
        job = JOBS.latest(ws["id"])
        return {"workspace": ws, "job": job.snapshot() if job else None}

    def _cancel_job(self, job_id):
        self._check_write()
        job = JOBS.get(job_id)
        if job is None:
            raise ApiError(404, "没有这个任务")
        job.cancel()
        return {"ok": True}

