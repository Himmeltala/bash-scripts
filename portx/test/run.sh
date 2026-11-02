#!/usr/bin/env bash
# portx 回归测试：起临时监听进程，验证查询、-k 杀进程、保护端口与退出码。
set -uo pipefail

here=${BASH_SOURCE[0]%/*}
[[ "$here" == "${BASH_SOURCE[0]}" ]] && here='.'
repo=$(cd "$here/../.." && pwd)
bin="$repo/portx/bin/portx"

tmp=$(mktemp -d "${TMPDIR:-/tmp}/portx-test.XXXXXX")
listener_pids=()
cleanup() {
  local pid
  for pid in "${listener_pids[@]}"; do
    kill "$pid" 2>/dev/null
  done
  rm -rf "$tmp"
}
trap cleanup EXIT

fail=0
ok() { printf 'ok   %s\n' "$*"; }
bad() { printf 'FAIL %s\n' "$*" >&2; fail=1; }

check_has() {
  local name=$1 needle=$2
  if grep -Fq -- "$needle" "$tmp/out"; then
    ok "$name"
  else
    bad "$name: 输出里没有 $needle"
    sed 's/^/     /' "$tmp/out" >&2
  fi
}

check_not() {
  local name=$1 needle=$2
  if grep -Fq -- "$needle" "$tmp/out"; then
    bad "$name: 输出里不该出现 $needle"
    sed 's/^/     /' "$tmp/out" >&2
  else
    ok "$name"
  fi
}

check_rc() {
  local name=$1 want=$2
  if ((rc == want)); then
    ok "$name"
  else
    bad "$name: 退出码 $rc，期望 $want"
    sed 's/^/     /' "$tmp/out" >&2
  fi
}

run() {
  "$bin" "$@" >"$tmp/out" 2>&1
  rc=$?
}

run_input() {
  local input=$1
  shift
  printf '%s\n' "$input" | "$bin" "$@" >"$tmp/out" 2>&1
  rc=$?
}

free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

# 监听进程把实际端口写进文件，并把工作目录切到 $tmp，便于断言“目录”。
start_listener() {
  local proto=$1 tag=$2 portfile="$tmp/$2.port"
  python3 - "$proto" "$portfile" "$tmp" <<'PY' &
import os, socket, sys, time
proto, portfile, workdir = sys.argv[1:4]
if proto == "udp":
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
else:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(("127.0.0.1", 0))
if proto != "udp":
    s.listen(16)
with open(portfile, "w") as f:
    f.write(str(s.getsockname()[1]))
os.chdir(workdir)
time.sleep(120)
PY
  listener_pids+=($!)
  local i
  for i in $(seq 100); do
    [[ -s $portfile ]] && return 0
    sleep 0.05
  done
  bad "$tag: 监听进程没写出端口"
  return 1
}

start_listener tcp tcp1
start_listener tcp tcp2
start_listener udp udp1
tcp1=$(cat "$tmp/tcp1.port")
tcp2=$(cat "$tmp/tcp2.port")
udp1=$(cat "$tmp/udp1.port")
# 取端口对应的 pid；ss 不可用时退回 lsof。
listener_pid=$(ss -H -ltnp "sport = :$tcp1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[[ -n $listener_pid ]] || listener_pid=$(lsof -nP -t -iTCP:"$tcp1" -sTCP:LISTEN 2>/dev/null | head -1)

run "$tcp1"
check_rc '查询有监听端口退出 0' 0
check_has '查询显示端口' "端口 $tcp1"
check_has '查询显示 PID' "PID $listener_pid"
check_has '查询显示程序' '程序:'
check_has '查询显示目录' '目录:'
check_has '查询显示工作目录' "$tmp"

run -n "$tcp1"
check_rc '-n 等同于查询' 0
check_has '-n 显示 PID' "PID $listener_pid"

run "$tcp1" "$tcp2"
check_rc '多个端口查询退出 0' 0
check_has '多个端口显示第一个' "端口 $tcp1"
check_has '多个端口显示第二个' "端口 $tcp2"

run "$(free_port)"
check_rc '无监听端口退出 1' 1
check_has '无监听提示' '无监听'

run 22
if ((rc == 3)); then
  bad '查询受保护端口不该被拦截'
else
  ok '查询受保护端口不被拦截'
fi

run -k -y 22
check_rc '-k 撞受保护端口退出 3' 3
check_has '-k 受保护端口提示' '受保护'

run -u "$udp1"
check_rc 'UDP 查询退出 0' 0
check_has 'UDP 查询显示端口' "端口 $udp1"

run -l
check_rc '-l 列出监听端口退出 0' 0
check_has '-l 表头含协议' '协议'
check_has '-l 显示 TCP 端口' "$tcp1"
check_has '-l 显示 PID' "$listener_pid"
check_has '-l 显示程序' 'python'

run -l -u
check_rc '-l -u 退出 0' 0
check_has '-l -u 显示 UDP 端口' "$udp1"

run -l -k
check_rc '-l 与 -k 不能同时用' 2

run -k
check_rc '-k 没给端口退出 2' 2

run_input q
check_rc '无参数进入主菜单，取消退出 0' 0
check_has '主菜单显示查询端口详情' '查询端口详情'
check_has '主菜单显示端口列表' '端口列表'
check_has '主菜单显示退出' '退出'

run -k -y "$tcp1"
check_rc '-k 杀掉监听进程退出 0' 0
check_has '-k 提示端口已释放' '已释放'
if kill -0 "$listener_pid" 2>/dev/null; then
  bad '-k 之后监听进程仍在'
else
  ok '-k 之后监听进程已退出'
fi

start_listener tcp tcp3
tcp3=$(cat "$tmp/tcp3.port")
tcp3_pid=${listener_pids[${#listener_pids[@]}-1]}

# 菜单回退模式：主菜单选“查询端口详情”，输入端口，查看详情后退出。
printf '1\n%s\nq\n' "$tcp3" | "$bin" >"$tmp/out" 2>&1
rc=$?
check_rc 'TUI 查询端口详情退出 0' 0
check_has 'TUI 详情显示端口' "端口 $tcp3"
check_has 'TUI 详情显示 PID' "PID $tcp3_pid"
check_has 'TUI 详情显示程序' '程序:'
check_has 'TUI 详情显示目录' '目录:'

# 主菜单选“端口列表”，列表里只能有端口，UDP 与返回放在工具条上。
printf '2\nq\nq\n' | "$bin" >"$tmp/tui-list.out" 2>&1
cp "$tmp/tui-list.out" "$tmp/out"
check_has 'TUI 端口列表显示测试端口' "p:TCP:$tcp3"
check_not 'TUI 端口列表不含 __udp 伪项' '__udp'
check_not 'TUI 端口列表不含 __back 伪项' '__back'
idx=$(awk -v pat="p:TCP:$tcp3" 'index($0, pat) { line=$0; sub(/^ +/, "", line); split(line, a, ")"); print a[1]; exit }' "$tmp/tui-list.out")
if [[ -z $idx ]]; then
  bad 'TUI 端口列表里找不到测试端口'
else
  printf '2\n%s\n2\ny\nq\nq\n' "$idx" | "$bin" >"$tmp/out" 2>&1
  rc=$?
  check_rc 'TUI 列表结束进程退出 0' 0
  check_has 'TUI 列表结束进程提示已释放' '已释放'
  if kill -0 "$tcp3_pid" 2>/dev/null; then
    bad 'TUI 列表结束进程后监听仍在'
  else
    ok 'TUI 列表结束进程后监听已退出'
  fi
fi

if ((fail)); then
  exit 1
fi
printf 'all tests passed\n'
