#!/usr/bin/env bash
# portx 加载器：先加载 bash-tui，再按 util、scan、ui、cli 顺序加载模块。
# 直接执行本文件等价于 portx 命令，便于调试。

set -uo pipefail

portx_dir=${BASH_SOURCE[0]%/*}
[[ "$portx_dir" == "${BASH_SOURCE[0]}" ]] && portx_dir='.'
readonly portx_dir

# shellcheck source=../../lib/tui-path.sh
if ! source "$portx_dir"/../../lib/tui-path.sh; then
  printf 'portx: 加载 bash-tui 失败，检查 BASH_TUI_DIR、同级检出或安装目录 vendor\n' >&2
  exit 1
fi

for portx_module in \
  "$portx_dir"/portx/util.sh \
  "$portx_dir"/portx/scan.sh \
  "$portx_dir"/portx/ui.sh \
  "$portx_dir"/portx/cli.sh
do
  source "$portx_module"
done
unset portx_module

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
