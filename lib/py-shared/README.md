# py-shared

idex、llmx、netx 共用的 Python 骨架，只用标准库，保持 Python 3.7 可导入。

## 使用

各工具的 `server.py` 把 `commons` 与 `services` 加进 `sys.path` 后直接 import，无需构建。`services` 可引用 `commons`，反过来不行。

## 测试

```bash
python3 -I lib/py-shared/test/test_shared.py
```
