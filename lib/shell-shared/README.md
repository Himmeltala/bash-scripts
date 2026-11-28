# shell-shared

mvnx、gradlex、idex、llmx、zipx、portx 共用的 bash 基础件，没有入口，各工具按顺序 `source`。

## 加载

```bash
SHELL_TOOL=mvnx
source lib/shell-shared/commons/base.sh
source lib/shell-shared/services/web-command.sh
```

`SHELL_TOOL` 必须先设；完整顺序见各工具的 `*-core.sh`。

## 测试

```bash
bash mvnx/test/run.sh
bash idex/tests/run.sh
```
