#!/usr/bin/env bash
# idex 加载器：按顺序 source idex/ 下的模块，cli 放最后。
# 直接执行本文件等价于 idex 命令，便于调试。

set -uo pipefail

# 不用 $(dirname ...) 以免派生进程：带斜杠取最后一段之前，不带斜杠取当前目录。
idex_dir=${BASH_SOURCE[0]%/*}
[[ "$idex_dir" == "${BASH_SOURCE[0]}" ]] && idex_dir='.'
readonly idex_dir

# 共享层：base 先设 SHELL_TOOL；idex 只有网页命令，不接记录界面与网页状态层。
SHELL_TOOL=idex
# shellcheck source=../../lib/shell-shared/commons/base.sh
source "$idex_dir"/../../lib/shell-shared/commons/base.sh
# shellcheck source=../../lib/shell-shared/services/web-command.sh
source "$idex_dir"/../../lib/shell-shared/services/web-command.sh

for idex_module in \
  "$idex_dir"/idex/server.sh
do
  source "$idex_module"
done

source "$idex_dir"/idex/cli.sh
unset idex_module

# 被入口 source 进来时只加载函数；直接执行本文件会运行主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
