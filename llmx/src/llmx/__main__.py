"""支持 python3 -m llmx，供 bin/llmx 的 shell 入口调用。"""

import sys

from .cli import main

sys.exit(main())
