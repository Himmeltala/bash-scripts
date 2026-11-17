#!/usr/bin/env bash
# nodex 加载器：按顺序 source nodex/ 下的模块，cli 放最后，加命令不必改本文件。
# 直接执行本文件等价于 nodex 命令，便于调试。

set -uo pipefail

# 不用 $(dirname ...) 以免派生进程：带斜杠取最后一段之前，不带斜杠取当前目录。
nodex_dir=${BASH_SOURCE[0]%/*}
[[ "$nodex_dir" == "${BASH_SOURCE[0]}" ]] && nodex_dir='.'
readonly nodex_dir

# shellcheck source=../../lib/shell-shared/commons/tui-path.sh
if ! source "$nodex_dir"/../../lib/shell-shared/commons/tui-path.sh; then
  printf 'nodex: 加载 bash-tui 失败，检查 BASH_TUI_DIR、同级检出或安装目录 vendor\n' >&2
  exit 1
fi

# 共享层：base 约定先设 SHELL_TOOL，再按需加载记录界面、命令注册表、机器接口与网页状态。
SHELL_TOOL=nodex
# shellcheck source=../../lib/shell-shared/commons/base.sh
source "$nodex_dir"/../../lib/shell-shared/commons/base.sh
# shellcheck source=../../lib/shell-shared/services/ui-records.sh
source "$nodex_dir"/../../lib/shell-shared/services/ui-records.sh
# shellcheck source=../../lib/shell-shared/services/command-table.sh
source "$nodex_dir"/../../lib/shell-shared/services/command-table.sh
# shellcheck source=../../lib/shell-shared/services/machine.sh
source "$nodex_dir"/../../lib/shell-shared/services/machine.sh
# shellcheck source=../../lib/shell-shared/services/web-state.sh
source "$nodex_dir"/../../lib/shell-shared/services/web-state.sh
# shellcheck source=../../lib/shell-shared/services/web-command.sh
source "$nodex_dir"/../../lib/shell-shared/services/web-command.sh

for nodex_module in \
  "$nodex_dir"/nodex/node.sh \
  "$nodex_dir"/nodex/exec.sh \
  "$nodex_dir"/nodex/server.sh
do
  source "$nodex_module"
done

source "$nodex_dir"/nodex/cli.sh
unset nodex_module

# 被入口 source 进来时只加载函数与注册表；直接执行本文件会运行主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
