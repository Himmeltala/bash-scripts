# shell-shared

nodex 与 mvnx 共用的 shell 基础件，dvcsx 只用其中的 `base.sh` 与 `web-command.sh`。不是工具，没有可执行入口；各自的 `*-core.sh` 按顺序 `source`，源码目录与 `~/.local/share/bash-scripts` 安装目录的层级一致。

## 目录

```
base.sh         退出码、FS、CACHE_DIR、die/usage_error、记录输出与路径工具
ui-records.sh   记录勾选与标签：shell_assign_tags、shell_ui_checklist*、shell_save_selection
web-state.sh    网页状态文件、目录锁、列操作、工作区辅助（nodex/mvnx）
web-command.sh  网页进程启动：起 python、等 READY、打印地址或 JSON、trap、wait
```

## 加载顺序

```bash
source lib/tui-path.sh              # 需要 bash-tui 的工具
SHELL_TOOL=nodex                    # 必须先设，base.sh 用它拼 CACHE_DIR 与错误前缀
source lib/shell-shared/base.sh
source lib/shell-shared/ui-records.sh
source lib/shell-shared/web-state.sh
source lib/shell-shared/web-command.sh
# 再加载工具自己的模块与 cli.sh
```

`SHELL_TOOL`、`EXIT_*`、`FS`、`CACHE_DIR` 都是 `readonly`，工具自己的文件里不要再定义同名变量，否则 bash 会报 `readonly variable`。

## 边界

- **记录界面只放形状，业务留在工具里。** `ui-records.sh` 只管六列记录的标签去重、勾选与回填；记录类型、标题名词与业务字段由调用方给。
- **网页状态只放骨架。** `web-state.sh` 不认 `script`/`pom`/`svc` 的具体列宽，由工具提供 `WEB_STATE_WIDTHS`；扫描、运行参数拼装、端口与错误识别仍在各自的 `server.sh`。
- **启动流程参数化。** `web-command.sh` 通过 `WEB_*` 全局配置工作；`NODEX_WEB_READY`、`MVNX_WEB_READY`、`DVCSX_WEB_READY` 与各工具的页面校验、提示文案都留在工具侧传入。
- **不要放 bash-tui 的函数。** `ui_*`、`tui_*` 归 bash-tui；共享函数统一用 `shell_` 或 `web_` 前缀。
- **`install.sh` / `uninstall.sh` 不接这一层。** 两者要支持脱离仓库的 `curl | bash`，重复是有意保留的。

## 测试

改动后跑：

```bash
bash nodex/test/run.sh
bash mvnx/test/run.sh
bash dvcsx/test/run.sh      # 需要 svn；缺 svn 时相关用例失败属环境问题
bash test/install-path.sh
```
