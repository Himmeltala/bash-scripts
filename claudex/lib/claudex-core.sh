#!/usr/bin/env bash
# claudex 加载器：util 与扫描先加载，动作与缓存依赖它们，界面与 cli 放最后。

set -uo pipefail

claudex_dir=${BASH_SOURCE[0]%/*}
[[ "$claudex_dir" == "${BASH_SOURCE[0]}" ]] && claudex_dir='.'
readonly claudex_dir

# shellcheck source=../../lib/tui-path.sh
if ! source "$claudex_dir"/../../lib/tui-path.sh; then
  printf 'claudex: 加载 bash-tui 失败，检查 BASH_TUI_DIR、同级检出或安装目录 vendor\n' >&2
  exit 1
fi

for claudex_module in \
  "$claudex_dir"/claudex/util.sh \
  "$claudex_dir"/claudex/sessions.sh \
  "$claudex_dir"/claudex/actions.sh \
  "$claudex_dir"/claudex/cache.sh \
  "$claudex_dir"/claudex/ui.sh \
  "$claudex_dir"/claudex/cli.sh
do
  source "$claudex_module"
done
unset claudex_module

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
