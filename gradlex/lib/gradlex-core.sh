#!/usr/bin/env bash
# gradlex 加载器：按顺序 source gradlex/ 下的模块与 commands 下的命令，cli 放最后，加命令不必改本文件。
# 直接执行本文件等价于 gradlex 命令，便于调试。

set -uo pipefail

# 不用 $(dirname ...) 以免派生进程：带斜杠取最后一段之前，不带斜杠取当前目录。
gradlex_dir=${BASH_SOURCE[0]%/*}
[[ "$gradlex_dir" == "${BASH_SOURCE[0]}" ]] && gradlex_dir='.'
readonly gradlex_dir

# shellcheck source=../../lib/tui-path.sh
if ! source "$gradlex_dir"/../../lib/tui-path.sh; then
  printf 'gradlex: 加载 bash-tui 失败，检查 BASH_TUI_DIR、同级检出或安装目录 vendor\n' >&2
  exit 1
fi

for gradlex_module in \
  "$gradlex_dir"/gradlex/util.sh \
  "$gradlex_dir"/gradlex/scan.sh \
  "$gradlex_dir"/gradlex/ui.sh \
  "$gradlex_dir"/gradlex/exec.sh
do
  source "$gradlex_module"
done

for gradlex_command in "$gradlex_dir"/gradlex/commands/*.sh; do
  [[ -f "$gradlex_command" ]] || continue
  source "$gradlex_command"
done

source "$gradlex_dir"/gradlex/cli.sh
unset gradlex_module gradlex_command

# 被入口 source 进来时只加载函数与注册表；直接执行本文件会运行主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
