"""支持 python3 -m tokx，供 bin/tokx 的 shell 入口调用。"""

import sys

from .cli import main

sys.exit(main())
