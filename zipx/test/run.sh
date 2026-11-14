#!/usr/bin/env bash
# zipx 回归：界面只画主文本不画标签，勾选项写名字、命令菜单写命令名；命令仍能加载。
set -uo pipefail
repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

if grep -q 'ui_textbox' "$repo/zipx/lib/zipx/info.sh"; then
  bad '仍使用 ui_textbox'
else
  ok '已改用统一分页接口'
fi

"$repo/zipx/bin/zipx" --help >/dev/null 2>&1 || bad 'zipx --help 失败'

# 画面里的控制序列去掉再比文本。
strip_ansi() { sed -e 's/\x1b\[[0-9;?]*[a-zA-Z]//g' -e 's/\r//g'; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/alpha-project" "$tmp/beta-module"
printf 'x\n' > "$tmp/notes.txt"

# 编号回退：标签就是名字，说明只留类型，两种模式下都该看得见名字。
plain=$(cd "$tmp" && printf '\n' | "$repo/zipx/bin/zipx" pack 2>&1 | strip_ansi)
for name in alpha-project beta-module notes.txt; do
  if [[ $plain == *"$name"* ]]; then
    ok "编号回退列出 $name"
  else
    bad "编号回退没列出 $name"
  fi
done

# 默认不排除任何条目：.git 与 node_modules 勾中就打进去；要排掉得自己给 --exclude。
mkdir -p "$tmp/proj/.git" "$tmp/proj/node_modules/x"
printf 'g\n' > "$tmp/proj/.git/config"
printf 'm\n' > "$tmp/proj/node_modules/x/a.js"
printf 'r\n' > "$tmp/proj/README.md"
if (cd "$tmp" && "$repo/zipx/bin/zipx" pack -o default.zip proj >/dev/null 2>&1); then
  listing=$(unzip -Z1 "$tmp/default.zip" 2>/dev/null)
  if [[ $listing == *'proj/.git/config'* && $listing == *'proj/node_modules/x/a.js'* ]]; then
    ok '默认把 .git 与 node_modules 一起打包'
  else
    bad '默认排除还在，.git 或 node_modules 没进包'
  fi
else
  bad '默认打包失败'
fi
if (cd "$tmp" && "$repo/zipx/bin/zipx" pack -o excl.zip proj --exclude 'proj/node_modules/*' >/dev/null 2>&1); then
  listing=$(unzip -Z1 "$tmp/excl.zip" 2>/dev/null)
  if [[ $listing == *'proj/.git/config'* && $listing != *'proj/node_modules'* ]]; then
    ok '--exclude 只排给定模式'
  else
    bad '--exclude 没有按给定模式排除'
  fi
else
  bad '带 --exclude 打包失败'
fi

if command -v script >/dev/null 2>&1; then
  printf 'q' > "$tmp/input"
  frame=$(cd "$tmp" && timeout 30 script -qec "bash '$repo/zipx/bin/zipx' pack" /dev/null \
    < "$tmp/input" 2>&1 | strip_ansi)
  for name in alpha-project beta-module notes.txt; do
    if [[ $frame == *"$name"* ]]; then
      ok "界面勾选列出 $name"
    else
      bad "界面勾选没列出 $name，整列只剩类型词"
    fi
  done

  # 命令菜单：主文本写命令名，说明只作小字解释。
  menu=$(cd "$tmp" && timeout 30 script -qec "bash '$repo/zipx/bin/zipx'" /dev/null \
    < "$tmp/input" 2>&1 | strip_ansi)
  for name in pack unpack info edit quit; do
    if [[ $menu =~ (^|[^[:alnum:]])$name([^[:alnum:]]|$) ]]; then
      ok "菜单画出命令名 $name"
    else
      bad "菜单没画出命令名 $name，只剩说明"
    fi
  done
else
  printf '跳过伪终端检查：未找到 script（util-linux）\n' >&2
fi

((fail)) && exit 1
printf '全部通过\n'
