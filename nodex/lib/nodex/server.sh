# 网页模式：bash 端。状态文件与一把目录锁在这里，页面与接口由 python3 转发（见 web/server.py）。
# 状态按行存、$FS 分列：bash 读写它不必管 JSON 转义，接口每轮请求现读现拼。
# 包怎么找、命令怎么拼，与命令行同源：同一个包、同一套参数，网页与终端跑出来的结果一样。

# 缺省值在这里定，parse_args 里覆盖，nodex -p 9999 web 与 nodex web -p 9999 等价。
RV_PORT=0
RV_HOST='0.0.0.0'
RV_OPEN=0
# 停止时先 TERM，这么多秒还没退干净再 KILL。
RV_GRACE=15
readonly WEB_ATTACH_TIMEOUT=20

readonly WEB_HOME="$CACHE_DIR/web"
readonly WEB_STATE_FILE="$WEB_HOME/state.tsv"
readonly WEB_LOCK_DIR="$WEB_HOME/lock"
readonly WEB_PEND_FILE="$WEB_HOME/pending"
readonly WEB_LOG_DIR="$WEB_HOME/logs"
readonly WEB_PAGE="$nodex_dir/nodex/web/static/index.html"
readonly WEB_API_PREFIX='/__nodex/api'

# 状态行首列决定这是什么，读写两侧照这张表：
#   ws  |id|root|added
#   pkg |rel|ws|name
#   svc |id|ws|type|dir|rel|args|display|cmd|pm
#   run |id|ws|type|tag|dir|rel|display|module|args|cmd|pid|port|status|started|code|err
# run 的 status 取 starting、ready、exited、failed、stopped；pid 是它的会话号，也是进程组号。
readonly WS_KIND='ws' SVC_KIND='svc' PKG_KIND='pkg' RUN_KIND='run'
readonly RUN_COL_PID=12 RUN_COL_PORT=13 RUN_COL_STATUS=14 RUN_COL_STARTED=15 RUN_COL_CODE=16 RUN_COL_ERR=17
# svc 行共 10 段：类型、服务 id，加下面这 8 个字段。
# 位置见这里，读写两侧都按它取。
readonly SVC_COL_DIR=5 SVC_COL_REL=6 SVC_COL_ARGS=7 SVC_COL_CMD=9 SVC_COL_PM=10

# 状态文件里当前行的位置，web_locate 与 web_set 靠它。
WEB_AT=0
FRAG=()
STATE_WIDTH=0
declare -A WS_ROOTS=()

web_fail() {
  printf 'nodex: %s\n' "$1" >&2
  return "${2:-$EXIT_FAIL}"
}

# 打印可用的 python3 解释器；没有或太旧就报错。只支持标准库，3.7 起够用。
web_python() {
  local runner=${NODEX_PYTHON:-python3} ver
  command -v "$runner" >/dev/null 2>&1 ||
    { web_fail "找不到 $runner，网页模式的转发进程靠它，先装上 python3" "$EXIT_USAGE"; return; }
  ver=$("$runner" -c 'import sys; print(sys.version_info[0] * 10 + sys.version_info[1])' 2>/dev/null) ||
    { web_fail "跑不起 $runner" "$EXIT_USAGE"; return; }
  ((ver >= 37)) || { web_fail '网页模式需要 python 3.7 或更新版本' "$EXIT_USAGE"; return; }
  printf '%s\n' "$runner"
}

# ---- 状态文件 ----

web_lock() {
  local n=0
  [[ -d "$WEB_HOME" ]] || mkdir -p "$WEB_HOME"
  until mkdir "$WEB_LOCK_DIR" 2>/dev/null; do
    n=$((n + 1))
    if ((n > 2000)); then
      web_fail "等锁 $WEB_LOCK_DIR 超时，确认没有残留的锁目录" "$EXIT_FAIL"
      return
    fi
    sleep 0.05
  done
  set -e
}

web_unlock() {
  rmdir "$WEB_LOCK_DIR" 2>/dev/null
  return 0
}

web_write_lines() {
  local tmp="$WEB_STATE_FILE.tmp"
  printf '%s\n' "$@" >"$tmp" && mv -f "$tmp" "$WEB_STATE_FILE"
}

web_state_load() {
  local line want
  STATE_LINES=()
  [[ -f "$WEB_STATE_FILE" ]] || return 0
  while IFS= read -r line; do
    case ${line%%"$FS"*} in
      "$WS_KIND"|"$PKG_KIND") want=4 ;;
      "$SVC_KIND") want=10 ;;
      "$RUN_KIND") want=17 ;;
      *) continue ;;
    esac
    web_split "$line"
    ((STATE_WIDTH == want)) && STATE_LINES+=("$line")
  done <"$WEB_STATE_FILE"
}

web_state_save() {
  web_write_lines "${STATE_LINES[@]+"${STATE_LINES[@]}"}"
}

# 按 $FS 切行，结果放在全局 FRAG（0 起）：记录首列是类型，宽度按类型补齐。
web_split() {
  local line=$1 i want=0
  FRAG=()
  IFS="$FS" read -r -a FRAG <<<"$line"
  case ${line%%"$FS"*} in
    "$WS_KIND"|"$PKG_KIND") want=4 ;;
    "$SVC_KIND") want=10 ;;
    "$RUN_KIND") want=17 ;;
    *) want=${#FRAG[@]} ;;
  esac
  for ((i = ${#FRAG[@]}; i < want; i++)); do FRAG[i]=''; done
  STATE_WIDTH=$want
}

# 取第 n 列（1 起），空列也认。
web_col() {
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
  local n=$1 line=$2
  shift 2
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
    if [[ -n "${want[$col]+x}" ]]; then
      v=${want[$col]}
    fi
    out+="$v"
  done
  printf '%s\n' "$out"
}

web_set() {
  web_split "${STATE_LINES[WEB_AT]+${STATE_LINES[WEB_AT]}}"
  STATE_LINES[WEB_AT]=$(web_row_set "$STATE_WIDTH" "${STATE_LINES[WEB_AT]+${STATE_LINES[WEB_AT]}}" "$@")
}

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

# ---- 工作区 ----

web_ws_id() {
  printf '%s\n' "$(printf '%s' "$1" | md5sum | cut -c1-12)"
}

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

# 加工作区：往上找最外层声明了工作区的目录；已登记过的同一根只重扫，历史运行记录保留。
web_ws_add() {
  local root id dir=$1
  dir=$(cd "$dir" 2>/dev/null && pwd) || { web_fail "目录不存在：$dir" "$EXIT_USAGE"; return 1; }
  root=$(find_workspace_root "$dir") || { web_fail "$dir 及其上级都没有 package.json，不是 Node 项目" "$EXIT_USAGE"; return 1; }
  id=$(web_ws_id "$root")
  web_lock || { web_fail '状态文件被占用，稍后再试'; return 1; }
  web_state_load
  if web_locate "$WS_KIND" "$id"; then
    web_set 3 "$root" 4 "$(date +%s)"
  else
    STATE_LINES+=("$WS_KIND$FS$id$FS$root$FS$(date +%s)")
  fi
  web_state_save
  web_unlock
  web_ws_scan "$id"
}

web_ws_remove() {
  local id=$1 row pid
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
    web_drop_ws "$id"
    web_state_save
  fi
  web_unlock
  rm -rf "${WEB_LOG_DIR:?}/$id"
}

# 删掉属于某个工作区的包行；它们的第 2 列是相对路径，按工作区 id 删的那支认不出来。
web_drop_ws() {
  local ws=$1 row keep=()
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    case ${row%%"$FS"*} in
      "$PKG_KIND") [[ "$(web_col "$row" 3)" == "$ws" ]] && continue ;;
    esac
    keep+=("$row")
  done
  STATE_LINES=("${keep[@]+"${keep[@]}"}")
}

# ---- 扫描 ----

# 一条服务行：类型、服务 id、工作区、动作、包目录、相对路径、参数、展示路径、展示命令、包管理器。
web_svc_line() {
  # 参数：工作区 id、动作、标签、包目录、相对路径、参数、展示路径、展示命令、包管理器。
  printf '%s\n' "$SVC_KIND$FS$1.$2.$3$FS$1$FS$2$FS$4$FS$5$FS$6$FS$7$FS$8$FS$9"
}

# 现扫一个工作区，结果逐行打到标准输出，不碰状态文件。
web_scan() {
  local id=$1 root=$2
  local rec tag dir rel args display cmdtext name

  prepare_packages "$root"

  while IFS= read -r rec; do
    IFS="$FS" read -r tag dir rel args display cmdtext <<<"$rec"
    web_svc_line "$id" dev "$tag" "$dir" "$rel" "$args" "$display" "$cmdtext" "$NODE_PM"
  done < <(collect_dev | assign_tags)

  while IFS= read -r rec; do
    IFS="$FS" read -r tag dir rel args display cmdtext <<<"$rec"
    web_svc_line "$id" build "$tag" "$dir" "$rel" "$args" "$display" "$cmdtext" "$NODE_PM"
  done < <(collect_build | assign_tags)

  while IFS= read -r rec; do
    IFS="$FS" read -r tag dir rel args display cmdtext <<<"$rec"
    web_svc_line "$id" install "$tag" "$dir" "$rel" "$args" "$display" "$cmdtext" "$NODE_PM"
  done < <(collect_install | assign_tags)

  for rel in "${NODE_PKGS[@]}"; do
    name=${PKG_NAME[$rel]}
    printf '%s\n' "$PKG_KIND$FS$rel$FS$id$FS$name"
  done
  return 0
}

# 用一个工作区的扫描结果替换旧的服务与包行；工作区与运行记录原样保留。
web_scan_apply() {
  local id=$1 file=$2 row line sid rel args pm width _sid _rel _args
  local -a fresh=() keep=() out=()
  local -A saved=()
  [[ -s "$file" ]] && mapfile -t fresh <"$file"
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    if [[ ${row%%"$FS"*} == "$SVC_KIND" ]] && [[ "$(web_col "$row" 3)" == "$id" ]]; then
      _sid=$(web_col "$row" 2)
      _rel=$(web_col "$row" 6)
      _args=$(web_col "$row" 7)
      saved[$_sid]="$_rel$FS$_args"
    fi
  done
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    case ${row%%"$FS"*} in
      "$SVC_KIND"|"$PKG_KIND") [[ "$(web_col "$row" 3)" == "$id" ]] && continue ;;
    esac
    keep+=("$row")
  done
  for line in "${fresh[@]+"${fresh[@]}"}"; do
    if [[ ${line%%"$FS"*} == "$SVC_KIND" ]]; then
      sid=$(web_col "$line" 2)
      if [[ -n "${saved[$sid]+x}" ]]; then
        web_split "$line"
        width=$STATE_WIDTH
        rel=${saved[$sid]%%"$FS"*}
        args=${saved[$sid]#*"$FS"}
        pm=$(web_col "$line" "$SVC_COL_PM")
        line=$(web_row_set "$width" "$line" "$SVC_COL_REL" "$rel" "$SVC_COL_ARGS" "$args" \
          "$SVC_COL_CMD" "$pm $args")
      fi
    fi
    out+=("$line")
  done
  STATE_LINES=("${keep[@]+"${keep[@]}"}" "${out[@]+"${out[@]}"}")
}

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

# ---- 运行记录 ----

web_log_file() {
  printf '%s/%s/%s.log\n' "$WEB_LOG_DIR" "$1" "$2"
}

# 会话里还有没有活着的 node 这一摊：包管理器退出了，它拉起的 dev 子进程还在也算在跑。
web_session_alive() {
  local sid=$1 line rest
  [[ "$sid" =~ ^[0-9]+$ ]] || return 1
  while IFS= read -r line; do
    rest=${line#"${line%%[![:space:]]*}"}
    [[ "${rest%%[[:space:]]*}" == "$sid" ]] || continue
    case "$line" in
      *node*|*pnpm*|*npm*|*yarn*|*vite*|*next*|*nuxt*|*webpack*|*tsx*|*ts-node*|*bun*) return 0 ;;
    esac
  done < <(ps -e -o sid= -o args= 2>/dev/null)
  return 1
}

web_group_alive() {
  local pgid=${1:-}
  [[ "$pgid" =~ ^[0-9]+$ ]] || return 1
  kill -0 -- "-$pgid" 2>/dev/null
}

# 从日志里找服务端口。Vite、Next、Nuxt、webpack 都会打一行带本机地址的 URL。
# 回退按「port 3000」「Listening on 3000」这类写法认；仓库地址与 HMR 的 websocket 端口不算。
web_detect_port() {
  local file=$1 text line
  [[ -f "$file" ]] || return 1
  text=$(tail -n 80 "$file" 2>/dev/null)
  local re_any='https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::\]):([0-9]{2,5})'
  local re_port='([Pp]ort|PORT)[^0-9]{0,12}([0-9]{2,5})'
  while IFS= read -r line; do
    # HMR 与调试端口是另一回事，别把 ws:// 或 inspector 的地址当成页面端口。
    [[ "$line" == *'ws://'* || "$line" == *'ws://localhost'* ]] && continue
    if [[ "$line" =~ $re_any ]]; then
      printf '%s\n' "${BASH_REMATCH[2]}"
      return 0
    fi
  done <<<"$text"
  while IFS= read -r line; do
    [[ "$line" == *'node --inspect'* ]] && continue
    if [[ "$line" =~ $re_port ]]; then
      printf '%s\n' "${BASH_REMATCH[2]}"
      return 0
    fi
  done <<<"$text"
  return 1
}

# 日志里第一条像样的错误，页面直接展示，省得去翻日志。
web_error_text() {
  local file=$1 line
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    case "$line" in
      *ERR_PNPM_*|*ERR!*|*'npm error'*|*'yarn error'*|*'error Command failed'*|*'Error:'*|*'error TS'*)
        line=${line#"${line%%[![:space:]]*}"}
        printf '%s\n' "${line:0:300}"
        return 0
        ;;
    esac
  done <"$file"
  return 0
}

web_exit_code() {
  local code
  code=$(<"$1.code") 2>/dev/null || return 0
  code=${code//[^0-9-]/}
  printf '%s\n' "$code"
}

# 进程没了才算结束；还活着就只做一件事：starting 且日志里出现了端口，就标成 ready。
web_advance() {
  local rid=$1 ws=$2 pid=$3 status=$4 file port code err waited=0
  file=$(web_log_file "$ws" "$rid")
  if web_session_alive "$pid"; then
    if [[ "$status" == 'starting' ]] && port=$(web_detect_port "$file"); then
      web_set "$RUN_COL_PORT" "$port" "$RUN_COL_STATUS" ready
      return 0
    fi
    return 1
  fi

  while ((waited < 20)) && [[ ! -f "$file.code" ]]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  code=$(web_exit_code "$file")
  err=$(web_error_text "$file")
  if [[ -n "$code" ]]; then
    web_set "$RUN_COL_PID" '' "$RUN_COL_CODE" "$code" "$RUN_COL_ERR" "$err"
    if [[ "$code" == '0' ]]; then
      web_set "$RUN_COL_STATUS" exited
    else
      web_set "$RUN_COL_STATUS" failed
    fi
  else
    web_set "$RUN_COL_PID" '' "$RUN_COL_STATUS" stopped
  fi
  return 0
}

# 收拾一遍在跑的记录，页面每隔两秒调一次。
web_poll() {
  local ws=$1 row idx status changed=0
  web_lock || return
  web_state_load
  idx=0
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    WEB_AT=$idx
    idx=$((idx + 1))
    [[ ${row%%"$FS"*} == "$RUN_KIND" ]] || continue
    if [[ -n "$ws" ]] && [[ "$(web_col "$row" 3)" != "$ws" ]]; then
      continue
    fi
    status=$(web_col "$row" "$RUN_COL_STATUS")
    case "$status" in
      starting|ready) ;;
      *) continue ;;
    esac
    web_advance "$(web_col "$row" 2)" "$(web_col "$row" 3)" \
      "$(web_col "$row" "$RUN_COL_PID")" "$status" && changed=1
  done
  ((changed)) && web_state_save
  web_unlock
}

# 停一个服务：整组发 TERM，给优雅退出留时间，超时再 KILL。进程早就没了就什么都不做。
web_stop_group() {
  local pgid=${1:-} waited=0
  [[ "$pgid" =~ ^[0-9]+$ ]] || return 0
  kill -TERM -- "-$pgid" 2>/dev/null || return 0
  while ((waited < RV_GRACE * 10)); do
    web_group_alive "$pgid" || return 0
    sleep 0.1
    waited=$((waited + 1))
  done
  kill -KILL -- "-$pgid" 2>/dev/null
  return 0
}

# ---- 启动 ----

# 页面改过参数就按页面给的走，否则用服务行里存着的。
web_launch_args() {
  local base=$1 extra=$2
  if [[ -n "$extra" ]]; then
    printf '%s %s\n' "$base" "$extra"
  else
    printf '%s\n' "$base"
  fi
}

# 一条 run 行：run|id|ws|type|tag|dir|rel|display|module|args|cmd|pid|port|status|started|code|err
web_run_line() {
  local svc=$1 id=$2 pid=$3 args=$4 cmd=$5
  local ws type tag dir rel display
  ws=$(web_col "$svc" 3)
  type=$(web_col "$svc" 4)
  tag=$(web_tag "$svc")
  dir=$(web_col "$svc" 5)
  rel=$(web_col "$svc" 6)
  display=$(web_col "$svc" 8)

  local starting_state='starting'
  local now
  now=$(date +%s)
  local out="$RUN_KIND$FS$id$FS$ws$FS$type$FS$tag$FS$dir$FS$rel$FS$display$FS$rel$FS$args$FS$cmd$FS$pid$FS"
  printf '%s\n' "$out$FS$starting_state$FS$now$FS$FS"
}

web_pend_save() {
  local gen
  gen=$(date +%s%N)
  printf '%s\n%s\n' "$1" "$2" >"$WEB_PEND_FILE" || return 1
  printf '%s\n' "$gen"
}

web_pend_load() {
  [[ -s "$WEB_PEND_FILE" ]] || return 1
  { IFS= read -r PEND_RUN && IFS= read -r PEND_LINE; } <"$WEB_PEND_FILE" || rm -f "$WEB_PEND_FILE"
  rm -f "$WEB_PEND_FILE"
  [[ -n "$PEND_LINE" ]]
}

# 启动的第一半：拼参数，把运行号、执行目录、参数、预排好的一行交回 python。
web_reserve() {
  local id=$1 extra=${2:-} svc dir base args pm runid line gen
  web_lock || return
  web_state_load
  if ! web_locate "$SVC_KIND" "$id"; then
    web_unlock
    printf 'nodex: 没有这个服务：%s\n' "$id" >&2
    return 1
  fi
  svc=$WEB_ROW
  web_unlock

  local type
  type=$(web_col "$svc" 4)
  dir=$(web_col "$svc" "$SVC_COL_DIR")
  base=$(web_col "$svc" "$SVC_COL_ARGS")
  pm=$(web_col "$svc" "$SVC_COL_PM")
  args=$(web_launch_args "$base" "$extra") || return
  runid="$id.$(date +%s%N)"
  line=$(web_run_line "$svc" "$runid" '' "$args" "$pm $args")

  gen=$(web_pend_save "$runid" "$line") || return
  printf '%s\n' "ok$FS$runid$FS$dir$FS$args$FS$line$FS$gen"
  return 0
}

# 启动的第二半：python 起好进程送回会话号，这里把会话号填进预排行再落盘。
web_launched() {
  local sid=$1 gen=$2 line out='' i v
  web_pend_load || { printf 'nodex: 这次启动已作废\n' >&2; return 1; }
  web_split "$PEND_LINE"
  for ((i = 1; i <= STATE_WIDTH; i++)); do
    v=${FRAG[i - 1]}
    [[ $i == "$RUN_COL_PID" ]] && v=$sid
    ((i > 1)) && out+="$FS"
    out+="$v"
  done
  line=$out
  web_lock || return
  web_state_load
  web_drop "$PEND_RUN"
  STATE_LINES+=("$line")
  web_state_save
  web_unlock
}

web_stop() {
  local id=$1 row pid=''
  web_lock || return
  web_state_load
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    [[ -n "$row" ]] || continue
    [[ ${row%%"$FS"*} == "$RUN_KIND" ]] || continue
    [[ "$(web_col "$row" 2)" == "$id" ]] || continue
    case "$(web_col "$row" "$RUN_COL_STATUS")" in
      starting|ready) pid=$(web_col "$row" "$RUN_COL_PID") ;;
      *) continue ;;
    esac
  done
  web_unlock
  [[ -n "$pid" ]] || { web_fail '这个服务没有在跑' "$EXIT_USAGE"; return; }

  web_stop_group "$pid"

  web_lock || return
  web_state_load
  web_locate "$RUN_KIND" "$id" && web_set "$RUN_COL_PID" '' "$RUN_COL_STATUS" stopped
  web_state_save
  web_unlock
}

web_txn_svc_set() {
  local id=$1 args=$2 pm
  web_locate "$SVC_KIND" "$id" || return 1
  pm=$(web_col "$WEB_ROW" "$SVC_COL_PM")
  web_set "$SVC_COL_ARGS" "$args" "$SVC_COL_CMD" "$pm $args"
}

web_update() {
  local id=$1 args=$2
  web_txn web_txn_svc_set "$id" "$args"
}

# ---- web 命令 ----

# 引擎：接住 python 递过来的请求流，一条请求一行。
web_engine() {
  local line req op out rc _id _extra
  if ! IFS= read -r line <&0 || [[ "$line" != "hello$FS"* ]]; then
    web_fail '控制通道握手不对，网页服务与 nodex 版本不一致'
    return
  fi
  while IFS= read -r line <&0; do
    [[ "$line" == "reqfrom$FS"* ]] || continue
    req=${line#*"$FS"}
    op=$(web_col "$req" 1)
    out=''
    rc=0
    case "$op" in
      tick) ;;
      add) web_ws_add "$(web_col "$req" 2)" || rc=$? ;;
      remove) web_ws_remove "$(web_col "$req" 2)" || rc=$? ;;
      scan) web_ws_scan "$(web_col "$req" 2)" || rc=$? ;;
      reserve)
        _id=$(web_col "$req" 2)
        _extra=$(web_col "$req" 3)
        out=$(web_reserve "$_id" "$_extra") || rc=$?
        ;;
      launched) web_launched "$(web_col "$req" 2)" "$(web_col "$req" 3)" || rc=$? ;;
      stop) web_stop "$(web_col "$req" 2)" || rc=$? ;;
      update) web_update "$(web_col "$req" 2)" "$(web_col "$req" 3)" || rc=$? ;;
      *) web_fail "网页请求不认识：$op" "$EXIT_USAGE" || rc=$? ;;
    esac
    web_poll ''
    if ((rc)); then
      printf 'fail\n'
      continue
    fi
    printf 'ok\n'
    [[ "$out" == "ok$FS"* ]] && printf '%s\n' "${out#ok$FS}"
  done
  return 0
}

# nodex web：起 python，等它就绪，然后就守着它；Ctrl+C 连 python 一起带走。
web_command() {
  local runner child log line='' waited=0 url local_url
  local -a open_arg=()
  runner=$(web_python) || return
  RV_PORT=${RV_PORT:-0}
  RV_HOST=${RV_HOST:-0.0.0.0}
  [[ "$RV_PORT" =~ ^[0-9]+$ ]] && ((RV_PORT >= 0 && RV_PORT <= 65535)) ||
    { web_fail "端口不对：$RV_PORT" "$EXIT_USAGE"; return; }
  [[ -f "$WEB_PAGE" ]] ||
    { web_fail "缺 ${WEB_PAGE#"$nodex_dir"/}，前端还没打包（见 nodex/web/README.md）" "$EXIT_USAGE"; return; }

  mkdir -p "$WEB_HOME" "$WEB_LOG_DIR"
  log="$WEB_HOME/runner.log"
  : >"$log"
  ((RV_OPEN)) && open_arg+=(--open)

  "$runner" "$nodex_dir/nodex/web/server.py" \
    --static "$nodex_dir/nodex/web/static" \
    --state "$WEB_STATE_FILE" --logs "$WEB_LOG_DIR" --api "$WEB_API_PREFIX" \
    --nodex "${NODEX_SELF:-$nodex_dir/../bin/nodex}" \
    --host "$RV_HOST" --port "$RV_PORT" "${open_arg[@]}" >"$log" 2>&1 &
  child=$!
  trap 'kill -TERM "$child" 2>/dev/null' INT TERM HUP

  while ((waited < WEB_ATTACH_TIMEOUT * 4)); do
    if ans=$(grep -m 1 '^NODEX_WEB_READY ' "$log" 2>/dev/null); then
      line=${ans#NODEX_WEB_READY }
      break
    fi
    kill -0 "$child" 2>/dev/null || { web_fail "网页服务起不来：$(tail -n 3 "$log" 2>/dev/null)"; return; }
    sleep 0.25
    waited=$((waited + 1))
  done
  [[ -n "$line" ]] || { web_fail '等网页服务就绪超时'; return; }

  url="http://$line/"
  local_url="http://127.0.0.1:${line##*:}/"
  if ((JSON_ONLY)); then
    printf '{"url":"%s","local":"%s","host":"%s","port":"%s"}\n' \
      "$url" "$local_url" "$RV_HOST" "${line##*:}"
    return 0
  fi
  printf 'nodex 网页界面：%s\n' "$url"
  [[ "$url" == "$local_url" ]] || printf '本机 %s\n' "$local_url"
  [[ "$RV_HOST" == '127.0.0.1' || "$RV_HOST" == 'localhost' ]] ||
    printf '页面没有登录，同一网络里能连上的人都能启停服务；只想本机用就加 --host 127.0.0.1\n' >&2
  printf '按 Ctrl+C 退出网页服务；正在跑的 node 在自己会话里，不跟着停，可在网页里停。\n' >&2
  wait "$child"
}

# 服务 id 形如 <工作区>.<类型>.<标签>；标签里可能还有点和斜杠，所以标签取第三段起。
web_tag() {
  local id
  id=$(web_col "$1" 2)
  printf '%s\n' "${id#*.*.}"
}
