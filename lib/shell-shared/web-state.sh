# 网页模式的状态文件与目录锁：按行存、$FS 分列，bash 读写不必管 JSON 转义。
# nodex / mvnx 使用；项目先声明 WEB_STATE_WIDTHS（首列类型 -> 列数）并设好
# WEB_HOME、WEB_STATE_FILE、WEB_LOCK_DIR、WEB_LOCK_PID、WEB_LOG_DIR，再 source 本文件。
# shellcheck shell=bash
# shellcheck source=./base.sh
# shellcheck disable=SC2154

# 状态文件里当前行的位置，web_locate 与 web_set 靠它。
WEB_AT=0
FRAG=()
STATE_WIDTH=0
# 工作区 id 到根的缓存，拼命令时要用。
declare -A WS_ROOTS=()

web_fail() {
  printf '%s: %s\n' "$SHELL_TOOL" "$1" >&2
  return "${2:-$EXIT_FAIL}"
}

# 打印可用的 python3 解释器；没有或太旧就报错。只支持标准库，3.7 起够用。
# 环境变量名由调用方给，例如 web_python NODEX_PYTHON。
web_python() {
  local env_var=${1:-} runner ver
  if [[ -n "$env_var" ]]; then
    runner=${!env_var:-python3}
  else
    runner=python3
  fi
  command -v "$runner" >/dev/null 2>&1 ||
    { web_fail "找不到 $runner，网页模式的转发进程靠它，先装上 python3" "$EXIT_USAGE"; return; }
  ver=$("$runner" -c 'import sys; print(sys.version_info[0] * 10 + sys.version_info[1])' 2>/dev/null) ||
    { web_fail "跑不起 $runner" "$EXIT_USAGE"; return; }
  ((ver >= 37)) || { web_fail '网页模式需要 python 3.7 或更新版本' "$EXIT_USAGE"; return; }
  printf '%s\n' "$runner"
}

# 状态文件

# 记下的持有者还在不在跑。僵尸进程也算没了：它不会再放锁，最多等着被回收。
web_lock_owner_alive() {
  local stat
  [[ "$1" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$1" 2>/dev/null || return 1
  stat=$(ps -o stat= -p "$1" 2>/dev/null) || return 1
  [[ "$stat" != Z* ]]
}

# 清掉一个确认没人管的锁：先删 pid 再删目录，这中间要是有人抢到并写了新 pid，目录就删不动，不会误伤。
web_lock_reap() {
  if [[ -z "$1" || "$(cat "$WEB_LOCK_PID" 2>/dev/null)" == "$1" ]]; then
    rm -f "$WEB_LOCK_PID" 2>/dev/null || :
  fi
  rmdir "$WEB_LOCK_DIR" 2>/dev/null || :
  return 0
}

web_lock() {
  local n=0 pid miss=0
  [[ -d "$WEB_HOME" ]] || mkdir -p "$WEB_HOME"
  until mkdir "$WEB_LOCK_DIR" 2>/dev/null; do
    n=$((n + 1))
    if ((n > 2000)); then
      pid=$(cat "$WEB_LOCK_PID" 2>/dev/null) || pid=''
      web_fail "等锁 $WEB_LOCK_DIR 超时，持锁进程是 ${pid:-不详}，看看它是不是卡住了" "$EXIT_FAIL"
      return
    fi
    pid=''
    if [[ -s "$WEB_LOCK_PID" ]]; then
      IFS= read -r pid <"$WEB_LOCK_PID" || true
    fi
    if [[ -n "$pid" ]]; then
      miss=0
      if ! web_lock_owner_alive "$pid"; then
        # 拿锁的进程中途没了，剩下一个空目录，清掉重抢。
        web_lock_reap "$pid"
        continue
      fi
    else
      # 刚建好锁、还没写进 pid 的那一瞬间也没有 pid：给半秒宽限，过了还没有就是建锁的人没了。
      miss=$((miss + 1))
      if ((miss > 10)); then
        web_lock_reap ''
        miss=0
        continue
      fi
    fi
    sleep 0.05
  done
  # $$ 在 $(...) 里取到的仍是引擎自己，不是那层子壳：引擎没了才该作废这个锁。
  printf '%s\n' "$$" >"$WEB_LOCK_PID" 2>/dev/null || :
  # 拿锁这一段在 $(...) 里跑，set -e 会关掉；手动开回来，锁后的失败才不会一路走到底。
  set -e
}

web_unlock() {
  rm -f "$WEB_LOCK_PID" 2>/dev/null || :
  # 目录已经被人清掉也算放开了：set -e 开着，这里失败会一路退到退出整个引擎。
  rmdir "$WEB_LOCK_DIR" 2>/dev/null || :
  return 0
}

# 整份替换写：读的人要么看到旧的整份，要么看到新的整份。
web_write_lines() {
  local tmp="$WEB_STATE_FILE.tmp" line
  # 一行一个换行；最后一行也补上，免得追加时粘到上一行。
  printf '%s\n' "$@" >"$tmp" && mv -f "$tmp" "$WEB_STATE_FILE"
}

# 只收形状认得出的行：首列决定后面有几列，写坏的行丢掉，不让一行打乱整份状态。
web_state_load() {
  local line want
  STATE_LINES=()
  [[ -f "$WEB_STATE_FILE" ]] || return 0
  # 循环体一律执行，别用 && 串：跳过的条件会悄悄吃掉最后一行。
  while IFS= read -r line; do
    want=${WEB_STATE_WIDTHS[${line%%"$FS"*}]:-}
    [[ -n "$want" ]] || continue
    web_split "$line"
    ((STATE_WIDTH == want)) && STATE_LINES+=("$line")
  done <"$WEB_STATE_FILE"
}

web_state_save() {
  web_write_lines "${STATE_LINES[@]+"${STATE_LINES[@]}"}"
}

# 按 $FS 切行，结果放在全局 FRAG（0 起）：记录首列是类型，宽度按类型的映射补齐。
# 切一次取多列；不在一行里连套几个 $(web_col ...)，那样每取一列都重切一遍。
web_split() {
  local line=$1 i want=0
  FRAG=()
  # 直接读进全局数组：中间过一道局部数组时，set -u 下取值会认不出格位。
  IFS="$FS" read -r -a FRAG <<<"$line"
  # 末尾的空列 read 会吞掉，按记录类型补齐，列号才对得上。
  want=${WEB_STATE_WIDTHS[${line%%"$FS"*}]:-}
  [[ -n "$want" ]] || want=${#FRAG[@]}
  for ((i = ${#FRAG[@]}; i < want; i++)); do FRAG[i]=''; done
  STATE_WIDTH=$want
}

# 取第 n 列（1 起），空列也认。
web_col() {
  # $1 是整行，$2 是第几列（1 起），越界给空串；切一次取多列，连套几个 web_col 也行。
  # 不用 read -a：它在 $( ) 里会并掉末尾空列；\x1f 在 C 语言环境里算空白，裸写进模式会丢格。
  local rest=$1 want=$2 i cut
  ((want >= 1)) || return 0
  for ((i = 1; i < want; i++)); do
    [[ "$rest" == *"$FS"* ]] || return 0
    rest=${rest#*"$FS"}
  done
  cut=${rest%%"$FS"*}
  if [[ "$cut" == "$rest" ]]; then
    printf '%s\n' "$rest"
  else
    printf '%s\n' "$cut"
  fi
}

# 换掉一行里若干列，结果打到标准输出：列号 值 列号 值 ……，列数以该行的类型为准。
web_row_set() {
  # 列号 值 列号 值 ……，换掉后整行打到标准输出。一次换几列都行。
  local n=$1 line=$2
  shift 2
  # 先切行再填词表：web_split 会把 FRAG 清空重建，顺序反了格子就都空了。
  web_split "$line"
  local -a want=()
  local at
  while (($# >= 2)); do
    at=$1
    want[$at]=$2
    shift 2
  done
  local i col out='' v
  for ((i = 0; i < n; i++)); do
    v=${FRAG[i]+${FRAG[i]}}
    ((i > 0)) && out+="$FS"
    col=$((i + 1))
    # 这一列要换才盖上去；不能用 ${want[col]-$v}，下标算不出来时它会被当成「取所有元素」。
    if [[ -n "${want[$col]+x}" ]]; then
      v=${want[$col]}
    fi
    out+="$v"
  done
  printf '%s\n' "$out"
}

# 换掉 STATE_LINES[WEB_AT] 里的若干列，配合 web_locate 用。
web_set() {
  # 列数以这一行自己的类型为准，web_split 会算出 STATE_WIDTH。
  # ${arr[i]+${arr[i]}}：直接取不存在的下标在 set -u 下会报成未定义变量。
  web_split "${STATE_LINES[WEB_AT]+${STATE_LINES[WEB_AT]}}"
  STATE_LINES[WEB_AT]=$(web_row_set "$STATE_WIDTH" "${STATE_LINES[WEB_AT]+${STATE_LINES[WEB_AT]}}" "$@")
}

# 按首列与 id 找行：位置放 WEB_AT，整行放 WEB_ROW。
web_locate() {
  local kind=$1 id=$2 row i=0
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    if [[ ${row%%"$FS"*} == "$kind" ]] && [[ "$(web_col "$row" 2)" == "$id" ]]; then
      WEB_AT=$i
      WEB_ROW=$row
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

# 按 id 删行，不管首列是什么。
web_drop() {
  local -a ids=("$@") keep=()
  local row i hit
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    hit=0
    for i in "${ids[@]}"; do
      [[ "$(web_col "$row" 2)" == "$i" ]] && hit=1
    done
    ((hit)) || keep+=("$row")
  done
  STATE_LINES=("${keep[@]+"${keep[@]}"}")
}

# 读、改、写回一趟：web_txn 函数名 参数…；函数在 STATE_LINES 上改，返回 0 才写回。
# 锁在这里拿，被调的函数里别再锁：目录锁不是可重入的，套第二次会一直等到超时。
web_txn() {
  local fn=$1 rc=0
  shift
  web_lock || return
  web_state_load
  "$fn" "$@" || rc=$?
  ((rc == 0)) && web_state_save
  web_unlock
  return "$rc"
}

# 工作区

web_ws_id() {
  printf '%s\n' "$(printf '%s' "$1" | md5sum | cut -c1-12)"
}

# 按工作区 id 取根；找不到就空着。
web_ws_root_of() {
  local id=$1 root=''
  if [[ -n "${WS_ROOTS[$id]+x}" ]]; then
    printf '%s\n' "${WS_ROOTS[$id]}"
    return 0
  fi
  if web_locate "$WS_KIND" "$id"; then
    root=$(web_col "$WEB_ROW" 3)
    WS_ROOTS[$id]=$root
  fi
  printf '%s\n' "$root"
}

# 删一个工作区，连同它的服务、运行记录与日志；还在跑的进程先停掉。
# 第二个参数是可选清理回调：锁内、web_drop 之后调用，用来删那些第 2 列不是工作区 id 的行。
web_ws_remove() {
  local id=$1 cleanup=${2:-} row pid
  web_lock || return
  web_state_load
  if web_locate "$WS_KIND" "$id"; then
    for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
      [[ ${row%%"$FS"*} == "$RUN_KIND" ]] || continue
      [[ "$(web_col "$row" 3)" == "$id" ]] || continue
      pid=$(web_col "$row" "$RUN_COL_PID")
      web_stop_group "$pid"
    done
    web_drop "$id"
    if [[ -n "$cleanup" ]]; then
      "$cleanup" "$id" || :
    fi
    web_state_save
  fi
  web_unlock
  rm -rf "${WEB_LOG_DIR:?}/$id"
}

# 扫一个已登记的工作区并合并结果。扫描要几秒，不持锁扫，只在写回时锁一次。
web_ws_scan() {
  local id=$1 root tmp
  web_lock || return
  web_state_load
  root=''
  web_locate "$WS_KIND" "$id" && root=$(web_col "$WEB_ROW" 3)
  web_unlock
  [[ -n "$root" && -d "$root" ]] || return 1

  tmp="$WEB_HOME/scan.$id.$$"
  web_scan "$id" "$root" >"$tmp"

  web_lock || { rm -f "$tmp"; return; }
  web_state_load
  web_scan_apply "$id" "$tmp"
  web_state_save
  web_unlock
  rm -f "$tmp"
}
