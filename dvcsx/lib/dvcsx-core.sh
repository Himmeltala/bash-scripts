#!/usr/bin/env bash
# dvcsx 加载器：按顺序 source dvcsx/ 下的模块，cli 放最后。
# 直接执行本文件等价于 dvcsx 命令，便于调试。

set -uo pipefail

# 不用 $(dirname ...) 以免派生进程：带斜杠取最后一段之前，不带斜杠取当前目录。
dvcsx_dir=${BASH_SOURCE[0]%/*}
[[ "$dvcsx_dir" == "${BASH_SOURCE[0]}" ]] && dvcsx_dir='.'
readonly dvcsx_dir

for dvcsx_module in \
  "$dvcsx_dir"/dvcsx/util.sh \
  "$dvcsx_dir"/dvcsx/web.sh
do
  source "$dvcsx_module"
done

source "$dvcsx_dir"/dvcsx/cli.sh
unset dvcsx_module

# 被入口 source 进来时只加载函数；直接执行本文件会运行主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
