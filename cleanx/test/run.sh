#!/usr/bin/env bash
# cleanx 迁移回归：确认不再直接调用 ui_textbox，命令仍能加载。
set -uo pipefail
repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

if grep -q 'ui_textbox' "$repo/cleanx/lib/cleanx/scan.sh"; then
  bad '仍使用 ui_textbox'
else
  ok '已改用统一分页接口'
fi

"$repo/cleanx/bin/cleanx" list >/dev/null 2>&1 || bad 'cleanx list 失败'
((fail)) && exit 1
printf '全部通过\n'
