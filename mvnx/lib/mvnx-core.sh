#!/usr/bin/env bash
# mvnx 加载器：按顺序 source mvnx/ 下的模块与 commands 下的命令，cli 放最后，加命令不必改本文件。
# 直接执行本文件等价于 mvnx 命令，便于调试。

set -uo pipefail

# 不用 $(dirname ...) 以免派生进程：带斜杠取最后一段之前，不带斜杠取当前目录。
mvnx_dir=${BASH_SOURCE[0]%/*}
[[ "$mvnx_dir" == "${BASH_SOURCE[0]}" ]] && mvnx_dir='.'
readonly mvnx_dir

# shellcheck source=../../lib/tui-path.sh
if ! source "$mvnx_dir"/../../lib/tui-path.sh; then
  printf 'mvnx: 加载 bash-tui 失败，检查 BASH_TUI_DIR、同级检出或安装目录 vendor\n' >&2
  exit 1
fi

for mvnx_module in \
  "$mvnx_dir"/mvnx/util.sh \
  "$mvnx_dir"/mvnx/pom.sh \
  "$mvnx_dir"/mvnx/ui.sh \
  "$mvnx_dir"/mvnx/exec.sh
do
  source "$mvnx_module"
done

for mvnx_command in "$mvnx_dir"/mvnx/commands/*.sh; do
  [[ -f "$mvnx_command" ]] || continue
  source "$mvnx_command"
done

source "$mvnx_dir"/mvnx/cli.sh
unset mvnx_module mvnx_command

# 被入口 source 进来时只加载函数与注册表；直接执行本文件会运行主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
