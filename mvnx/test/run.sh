#!/usr/bin/env bash
# mvnx 迁移回归：确认不再保留自定义编号清单，命令仍能加载。
set -uo pipefail
repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

if grep -q 'mvnx_plain_checklist' "$repo/mvnx/lib/mvnx/ui.sh"; then
  bad '仍保留自定义编号清单'
else
  ok '已删除自定义编号清单'
fi

"$repo/mvnx/bin/mvnx" --help >/dev/null 2>&1 || bad 'mvnx --help 失败'
((fail)) && exit 1
printf '全部通过\n'
