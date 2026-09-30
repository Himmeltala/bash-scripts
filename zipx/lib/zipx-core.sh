#!/usr/bin/env bash
# zipx 的加载器。核心机制按职责拆在 zipx/ 目录下，这里只按顺序 source。
# util 提供退出码与执行出口，ui 提供界面控件，四个动作文件分别管压缩、解压、
# 查看校验、包内增删；cli 放最后，它引用的动作函数必须已经加载完。
# 入口 bin/zipx 只 source 本文件，然后调 main。
#
# 直接执行本文件等价于 zipx 命令，调试单步方便。

set -uo pipefail

# 不用 $(dirname ...)，少派生两个进程。带斜杠就取最后一段之前的部分，
# 不带斜杠说明是在本目录下用文件名执行的，取当前目录。
zipx_dir=${BASH_SOURCE[0]%/*}
[[ "$zipx_dir" == "${BASH_SOURCE[0]}" ]] && zipx_dir='.'
readonly zipx_dir

for zipx_module in \
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

# 被入口 source 进来时只加载；直接执行本文件就跑主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
