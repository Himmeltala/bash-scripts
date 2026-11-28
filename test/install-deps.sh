#!/usr/bin/env bash
# 验证 install.sh 的可选依赖入口：列表、未知名字与路径穿越都被正确处理。
# 不真正安装依赖，任何会落盘的 --deps 调用都只用非法名字。

set -uo pipefail
repo=$(cd "${1:-$(dirname "$0")/..}" && pwd)
pass=0 fail=0
ok() { printf 'ok - %s\n' "$*"; pass=$((pass + 1)); }
bad() { printf 'not ok - %s\n' "$*"; fail=$((fail + 1)); }

log=$(mktemp)
trap 'rm -f "$log"' EXIT

if "$repo/install.sh" --list-deps >"$log" 2>&1 && grep -q 'libreoffice' "$log"; then
  ok '列出 libreoffice'
else
  bad "列表里没有 libreoffice: $(cat "$log")"
fi

if "$repo/install.sh" --deps nope >"$log" 2>&1; then
  bad '未知依赖应失败'
else
  ok '未知依赖失败'
fi
grep -q '没有这个可选依赖' "$log" && ok '未知依赖有提示' || bad "提示不对: $(cat "$log")"

for name in '../x' 'a/b' 'A B' ''; do
  if "$repo/install.sh" --deps "$name" >"$log" 2>&1; then
    bad "非法依赖名应失败: $name"
  else
    ok "拒绝非法依赖名: ${name:-空}"
  fi
done

if "$repo/install.sh" --deps >"$log" 2>&1; then
  bad '缺参数应失败'
else
  ok '缺参数失败'
fi

printf '\n%d 通过，%d 失败\n' "$pass" "$fail"
((fail == 0))
