# shell-shared

nodex 用全部基础件，mvnx 用 `base.sh` 与 `ui-records.sh`，dvcsx 用 `base.sh` 与 `web-command.sh`。不是工具，没有入口；各工具按顺序 `source`。

```
base.sh         退出码、FS、CACHE_DIR、die/usage_error、路径工具
ui-records.sh   记录勾选与标签：shell_assign_tags、shell_ui_checklist*、shell_save_selection
web-state.sh    网页状态文件、目录锁、列操作、工作区辅助
web-command.sh  起 python、等 READY、打印地址或 JSON、trap、wait
```

## 加载

```bash
source lib/tui-path.sh              # 需要 bash-tui 的工具
SHELL_TOOL=nodex                    # 必须先设，base.sh 用它拼 CACHE_DIR 与错误前缀
source lib/shell-shared/base.sh
source lib/shell-shared/ui-records.sh
source lib/shell-shared/web-state.sh
source lib/shell-shared/web-command.sh
```

`SHELL_TOOL`、`EXIT_*`、`FS`、`CACHE_DIR` 是 `readonly`，工具里不要重名定义。

## 边界

- 记录界面只放形状：标签去重、勾选与回填；记录类型与业务字段由调用方给。
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
