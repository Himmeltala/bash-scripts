#!/usr/bin/env bash
# 在临时 HOME 里验证 install.sh 的 PATH 判定：系统配置已给 PATH 时不写 .bashrc，改不了时照写。
# 用法: test/install-path.sh [仓库根目录]

set -uo pipefail
repo=$(cd "${1:-$(dirname "$0")/..}" && pwd)
pass=0 fail=0
ok()   { printf 'ok - %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf 'not ok - %s\n' "$*"; fail=$((fail+1)); }

log=$(mktemp)
trap 'rm -rf /tmp/path_test_home* "$log" /tmp/path_test_env' EXIT

make_home() {
  local home=$1 profile=$2
  rm -rf "$home"
  mkdir -p "$home"
  printf 'export FOO=1\n' > "$home/.bashrc"
  if [[ "$profile" == yes ]]; then
    printf '%s\n' 'if [ -d "$HOME/.local/bin" ] ; then' '    PATH="$HOME/.local/bin:$PATH"' 'fi' > "$home/.profile"
  fi
}

run() {  # run <home> [env...]
  local home=$1; shift
  env HOME="$home" BASH_SCRIPTS_ENVIRONMENT=/nonexistent "$@" "$repo/install.sh" >"$log" 2>&1
}

# 1. Debian 默认：有 .profile 那句，默认链接目录，不写 .bashrc
h=/tmp/path_test_home1; make_home "$h" yes
run "$h"
if ! grep -q 'bash-scripts 装的工具' "$h/.bashrc"; then
  ok "有 .profile 时不写 .bashrc"
else
  bad "有 .profile 时 .bashrc: $(cat "$h/.bashrc")"
fi
grep -q '不写' "$log" && ok "提示不写 .bashrc" || bad "没有提示"

# 2. 没有 .profile 就写 .bashrc
h=/tmp/path_test_home2; make_home "$h" no
run "$h"
if grep -qF 'export PATH="$HOME/.local/bin:$PATH"' "$h/.bashrc"; then ok "没有 .profile 时写 .bashrc"; else bad ".bashrc 没写: $(cat "$h/.bashrc")"; fi
head -1 "$h/.bashrc" | grep -qx 'export FOO=1' && ok "原有内容保留" || bad "原有内容被改"

# 3. 自定义链接目录：不管 .profile 都写
h=/tmp/path_test_home3; make_home "$h" yes
env HOME="$h" BASH_SCRIPTS_ENVIRONMENT=/nonexistent BASH_SCRIPTS_BIN_DIR="$h/bin2" "$repo/install.sh" >"$log" 2>&1
grep -qF "export PATH=\"$h/bin2:\$PATH\"" "$h/.bashrc" && ok "自定义目录写进 .bashrc" || bad "自定义目录没写: $(cat "$h/.bashrc")"

# 4. /etc/environment 已经有（字面路径，不带 $HOME），不写
h=/tmp/path_test_home4; make_home "$h" no
printf 'PATH="/usr/local/bin:%s/.local/bin"\n' "$h" > /tmp/path_test_env
# 用默认链接目录时 .profile 不存在，靠环境文件这一条判定
env HOME="$h" BASH_SCRIPTS_ENVIRONMENT=/tmp/path_test_env "$repo/install.sh" >"$log" 2>&1
grep -q 'bash-scripts 装的工具' "$h/.bashrc" && bad "环境文件已有时仍写了 .bashrc" || ok "环境文件已有时不写 .bashrc"

# 4b. 环境文件里写成字面 $HOME 时不展开，不算覆盖，照写 .bashrc
h=/tmp/path_test_home5; make_home "$h" no
printf 'PATH="/usr/local/bin:$HOME/.local/bin"\n' > /tmp/path_test_env
env HOME="$h" BASH_SCRIPTS_ENVIRONMENT=/tmp/path_test_env "$repo/install.sh" >"$log" 2>&1
grep -q 'bash-scripts 装的工具' "$h/.bashrc" && ok "环境文件写的是字面 \$HOME，不当作已覆盖" || bad "误判为已覆盖"

# 5. 重装幂等：第 2 种情形再跑一次，仍然只有一行
run "$h" 2>/dev/null
h=/tmp/path_test_home2
env HOME="$h" BASH_SCRIPTS_ENVIRONMENT=/nonexistent "$repo/install.sh" >"$log" 2>&1
n=$(grep -cF 'export PATH="$HOME/.local/bin:$PATH"' "$h/.bashrc")
[[ "$n" == 1 ]] && ok "重复安装不叠加 PATH 行" || bad "PATH 行有 $n 条"

# 6. 卸载把标记段摘干净
env HOME="$h" "$repo/uninstall.sh" >"$log" 2>&1
if grep -q 'bash-scripts 装的工具' "$h/.bashrc" || grep -q '.local/bin' "$h/.bashrc"; then
  bad "卸载后 .bashrc 仍残留: $(cat "$h/.bashrc")"
else
  ok "卸载摘干净"
fi
printf 'export FOO=1\n' | diff -q - "$h/.bashrc" >/dev/null && ok "卸载还原原内容" || bad "卸载后内容: $(cat "$h/.bashrc")"

rm -rf /tmp/path_test_home*
printf '\n通过 %d，失败 %d\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
