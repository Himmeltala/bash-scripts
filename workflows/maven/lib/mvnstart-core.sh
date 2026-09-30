#!/usr/bin/env bash
# mvnstart 的加载器。核心机制按职责拆在 mvnstart/ 目录下，这里只按顺序 source。
# util 提供记录分列与路径计算，pom 提供扫描结果，其余建立在这两者之上；
# commands 下每条命令一个文件，由通配加载，加命令不必改本文件；cli 放最后。
# 入口（bin 下的 mvnstart 与 mvnstart-*）只 source 本文件，然后调 main。
#
# 直接执行本文件等价于 mvnstart 命令，调试单步方便。

set -uo pipefail

# 不用 $(dirname ...)，少派生两个进程。带斜杠就取最后一段之前的部分，
# 不带斜杠说明是在本目录下用文件名执行的，取当前目录。
mvnstart_dir=${BASH_SOURCE[0]%/*}
[[ "$mvnstart_dir" == "${BASH_SOURCE[0]}" ]] && mvnstart_dir='.'
readonly mvnstart_dir

for mvnstart_module in \
  "$mvnstart_dir"/mvnstart/util.sh \
  "$mvnstart_dir"/mvnstart/pom.sh \
  "$mvnstart_dir"/mvnstart/ui.sh \
  "$mvnstart_dir"/mvnstart/exec.sh
do
  source "$mvnstart_module"
done

for mvnstart_command in "$mvnstart_dir"/mvnstart/commands/*.sh; do
  [[ -f "$mvnstart_command" ]] || continue
  source "$mvnstart_command"
done

source "$mvnstart_dir"/mvnstart/cli.sh
unset mvnstart_module mvnstart_command

# 被入口 source 进来时只加载函数与注册表；直接执行本文件就跑主流程。
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
