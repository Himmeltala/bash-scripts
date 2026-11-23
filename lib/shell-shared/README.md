# shell-shared

mvnx、gradlex、idex、llmx、zipx、portx 共用的 bash 基础件。不是工具，没有入口，各工具按顺序 `source`。

```
commons/
  base.sh        退出码、FS、CACHE_DIR、die/usage_error、路径工具
  tui-path.sh    定位并加载 bash-tui
services/
  ui-records.sh    记录勾选与标签
  command-table.sh 命令注册表与菜单
  machine.sh       机器接口：JSON 转义、目标清单、批量启动
  web-state.sh     网页状态文件与目录操作
  web-command.sh   起 Python 网页进程
```

## 加载

```bash
SHELL_TOOL=mvnx
source lib/shell-shared/commons/base.sh
source lib/shell-shared/services/web-command.sh
```

`SHELL_TOOL` 必须先设，`base.sh` 用它拼 `CACHE_DIR` 与错误前缀。按工具需要加载对应模块，完整顺序见各工具的 `*-core.sh`。

## 测试

```bash
bash mvnx/test/run.sh
bash mvnx/test/run.sh
bash idex/test/run.sh      # 需要 svn
bash test/install-path.sh
```
