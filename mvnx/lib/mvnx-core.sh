#!/usr/bin/env bash
# mvnx 的加载器。核心机制按职责拆在 mvnx/ 目录下，这里只按顺序 source。
# util 提供记录分列与路径计算，pom 提供扫描结果，其余建立在这两者之上；
# commands 下每条命令一个文件，由通配加载，加命令不必改本文件；cli 放最后。
# 入口 bin/mvnx 只 source 本文件，然后调 main。
#
# 直接执行本文件等价于 mvnx 命令，调试单步方便。

set -uo pipefail

# 不用 $(dirname ...)，少派生两个进程。带斜杠就取最后一段之前的部分，
# 不带斜杠说明是在本目录下用文件名执行的，取当前目录。
mvnx_dir=${BASH_SOURCE[0]%/*}
[[ "$mvnx_dir" == "${BASH_SOURCE[0]}" ]] && mvnx_dir='.'
readonly mvnx_dir

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

# 被入口 source 进来时只加载函数与注册表；直接执行本文件就跑主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
