"""jvmx：Maven 与 Gradle 工作区的网页启停壳。

目标发现与执行仍由 mvnx / gradlex 完成，这里只登记工作区、起进程、收日志与推状态。
"""

import sys
from pathlib import Path

# 共用骨架在仓库根的 lib/py-shared 下，通用件与服务件各占一层，源码与安装后的相对层级一致。
_SHARED = Path(__file__).resolve().parents[3] / "lib" / "py-shared"
for _part in ("commons", "services"):
    _path = str(_SHARED / _part)
    if _path not in sys.path:
        sys.path.insert(0, _path)

VERSION = "0.1.0"
