#!/usr/bin/env bash
# dvcsx 回归：临时 SVN / Git 仓库上的查询与接口，加上命令行的用法检查。
set -uo pipefail
repo=$(cd "${BASH_SOURCE[0]%/*}/.." && pwd)
dvcsx="$repo/bin/dvcsx"
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

# python 侧：每条用例打一行，失败时把 unittest 的尾巴贴出来。
for suite in test_svn.py test_git.py; do
  out=$(python3 -I "$repo/test/$suite" -v 2>&1)
  rc=$?
  while IFS= read -r line; do
    case "$line" in
      *' ... ok') ok "${line% ... ok}" ;;
      *' ... FAIL'|*' ... ERROR') bad "${line% ... *}" ;;
    esac
  done <<<"$out"
  if ((rc != 0)); then
    printf '%s\n' "$out" | tail -n 20 >&2
    bad "$suite 用例没有全过"
  fi
done

"$dvcsx" --help >/dev/null 2>&1 && ok '--help 正常' || bad '--help 失败'
if "$dvcsx" --no-such-option >/dev/null 2>&1; then
  bad '未知选项没有报错'
else
  code=$?
  ((code == 2)) && ok '未知选项退 2' || bad "未知选项退了 $code"
fi

((fail)) && exit 1
printf '全部通过\n'
