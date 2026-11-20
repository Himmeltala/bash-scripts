"""后台写操作：任务对象与执行线程在共享的 jobqueue，这里给 idex 的超时与任务表。"""

from jobqueue import (  # noqa: F401  再导出给别人用
    DEFAULT_JOB_TIMEOUT,
    JOB_KEEP,
    JOB_LINES_MAX,
    Job,
    Jobs,
    run_job,
    terminate_process,
)

# 单条命令最长跑多久，超时整组进程收到 TERM。
OPERATION_TIMEOUT = DEFAULT_JOB_TIMEOUT

JOBS = Jobs()
