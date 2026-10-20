#!/usr/bin/env bash
# zipx 加载器：按顺序 source util、ui 与四个动作文件，cli 放最后，它引用的动作函数须先加载完。
# 直接执行本文件等价于 zipx 命令，便于调试。

set -uo pipefail

# 不用 $(dirname ...) 以免派生进程：带斜杠取最后一段之前，不带斜杠取当前目录。
zipx_dir=${BASH_SOURCE[0]%/*}
[[ "$zipx_dir" == "${BASH_SOURCE[0]}" ]] && zipx_dir='.'
readonly zipx_dir

for zipx_module in \
  "$zipx_dir"/../../lib/tui.sh \
  "$zipx_dir"/zipx/util.sh \
  "$zipx_dir"/zipx/ui.sh \
  "$zipx_dir"/zipx/pack.sh \
  "$zipx_dir"/zipx/unpack.sh \
  "$zipx_dir"/zipx/info.sh \
  "$zipx_dir"/zipx/edit.sh \
  "$zipx_dir"/zipx/cli.sh
do
  source "$zipx_module"
done
unset zipx_module

# 被入口 source 进来时只加载；直接执行本文件会运行主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
