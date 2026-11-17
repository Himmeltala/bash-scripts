# shell-shared

nodex 用全部基础件，mvnx 用 `base.sh`、`ui-records.sh`、`command-table.sh`、`machine.sh`，gradlex 与 mvnx 相同但不接网页；dvcsx 用 `base.sh` 与 `web-command.sh`。不是工具，没有入口；各工具按顺序 `source`。

```
commons/                                  与工具无关的通用件
  base.sh        退出码、FS、CACHE_DIR、die/usage_error、路径工具
  tui-path.sh    定位并加载 bash-tui
services/                                 这几个工具共用的业务骨架
  ui-records.sh    记录勾选与标签：shell_assign_tags、shell_ui_checklist*、shell_save_selection
  command-table.sh 命令注册表：shell_command_exists / _field，菜单项与菜单循环
  machine.sh       机器接口：JSON 转义、目标清单、整批启动
  web-state.sh     网页状态文件、目录锁、列操作、工作区辅助
  web-command.sh   起 python、等 READY、打印地址或 JSON、trap、wait
```

`commons` 不引用 `services`，`services` 可以引用 `commons`。

## 加载

```bash
source lib/shell-shared/commons/tui-path.sh   # 需要 bash-tui 的工具
SHELL_TOOL=nodex                              # 必须先设，base.sh 用它拼 CACHE_DIR 与错误前缀
source lib/shell-shared/commons/base.sh
source lib/shell-shared/services/ui-records.sh
source lib/shell-shared/services/command-table.sh
source lib/shell-shared/services/machine.sh
source lib/shell-shared/services/web-state.sh
source lib/shell-shared/services/web-command.sh
```

`SHELL_TOOL`、`EXIT_*`、`FS`、`CACHE_DIR` 是 `readonly`，工具里不要重名定义。

`command-table.sh` 读调用方的 `COMMANDS` 数组，`shell_ui_main` 还用到 `run_action` 与 bash-tui 的 `ui_menu_named`；`machine.sh` 的启动函数、收集函数都由调用方传入。

## 边界

- 记录界面只放形状：标签去重、勾选与回填；记录类型与业务字段由调用方给。
- 命令表只放查询与菜单：注册表内容、参数解析、动作实现留在各工具 `cli.sh`。
- 机器接口只放协议：记录仍是六列，JSON 字段名与批量启动的输出文案在这里统一；收集与启动的具体命令由工具传。
- 网页状态只放骨架：`web-state.sh` 不认具体列宽，由工具提供 `WEB_STATE_WIDTHS`；扫描、参数拼装、端口识别留在各自 `server.sh`。
- 启动流程参数化：`web-command.sh` 通过 `WEB_*` 配置，`*_WEB_READY`、页面校验与提示文案由工具传。
- `ui_*`、`tui_*` 归 bash-tui；共享函数统一用 `shell_` 或 `web_` 前缀。
- `install.sh` / `uninstall.sh` 不接这一层，两者要能 `curl | bash`。

## 测试

```bash
bash nodex/test/run.sh
bash mvnx/test/run.sh
bash dvcsx/test/run.sh      # 需要 svn
bash test/install-path.sh
```
