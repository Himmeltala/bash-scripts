#!/usr/bin/env bash
# cleanx 加载器：先 util 与注册表，再三类清理项，runner 与 scan 依赖它们，cli 放最后。
# 直接执行本文件等价于 cleanx 命令，便于调试。

set -uo pipefail

cleanx_dir=${BASH_SOURCE[0]%/*}
[[ "$cleanx_dir" == "${BASH_SOURCE[0]}" ]] && cleanx_dir='.'
readonly cleanx_dir

# shellcheck source=../../lib/tui-path.sh
if ! source "$cleanx_dir"/../../lib/tui-path.sh; then
  printf 'cleanx: 加载 bash-tui 失败，检查 BASH_TUI_DIR、同级检出或安装目录 vendor\n' >&2
  exit 1
fi

for cleanx_module in \
  "$cleanx_dir"/cleanx/util.sh \
  "$cleanx_dir"/cleanx/registry.sh \
  "$cleanx_dir"/cleanx/items-user.sh \
  "$cleanx_dir"/cleanx/items-system.sh \
  "$cleanx_dir"/cleanx/items-dev.sh \
  "$cleanx_dir"/cleanx/runner.sh \
  "$cleanx_dir"/cleanx/scan.sh \
  "$cleanx_dir"/cleanx/ui.sh \
  "$cleanx_dir"/cleanx/cli.sh
do
  source "$cleanx_module"
done
unset cleanx_module

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
