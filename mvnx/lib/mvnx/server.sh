# 网页模式：bash 端。状态文件与一把目录锁在这里，页面与接口由 python3 转发（见 web/server.py）。
# 状态按行存、$FS 分列：bash 读写它不必管 JSON 转义，接口每轮请求现读现拼。
# 服务怎么起来照命令行的判定：同一个模块、同一套参数，网页与终端跑出来的结果一样。

# 缺省值在这里定，parse_args 里覆盖，mvnx -p 9999 web 与 mvnx web -p 9999 等价。
# 与 tokx 一致：默认绑所有网卡，同网络的机器能直接打开；端口 0 由系统挑一个空闲的。
RV_PORT=0
RV_HOST='0.0.0.0'
RV_OPEN=0
# 停止时先 TERM，这么多秒还没退干净再 KILL。
RV_GRACE=15
# mvnx web 起 python 后每秒看一次它有没收摊，收摊了就退出；几秒内起不来就算启动失败。
readonly WEB_ATTACH_INTERVAL=1
readonly WEB_ATTACH_TIMEOUT=20

readonly WEB_HOME="$CACHE_DIR/web"
readonly WEB_STATE_FILE="$WEB_HOME/state.tsv"
readonly WEB_LOCK_DIR="$WEB_HOME/lock"
# reserve 与 launched 之间交接预排行的临时文件。
readonly WEB_PEND_FILE="$WEB_HOME/pending"
readonly WEB_LOG_DIR="$WEB_HOME/logs"
readonly WEB_PAGE="$mvnx_dir/mvnx/web/static/index.html"
# 接口挂在单独的前缀下，HttpOnly 的 Cookie 只认 Path，前缀对得上才随请求上来。
readonly WEB_API_PREFIX='/__mvnx/api'
# 页面按 F5 刷新不是导航拦截，浏览器为兼容忽略这条但会打警告，这里点名它。
readonly WEB_VIEW_TRANSITIONS='https://web.dev/bfcache/navigation/*'

# 状态行首列决定这是什么，读写两侧照这张表：
#   ws  |id|root|added
#   svc |id|ws|type|path|pl|args|display|cmd
#   pom |id|ws|rel
#   run |id|ws|type|tag|path|display|pl|args|cmd|pid|port|status|started|code|err
# run 的 status 取 starting、ready、exited、failed、stopped；pid 是它的会话号，也是进程组号。
readonly WS_KIND='ws' SVC_KIND='svc' POM_KIND='pom' RUN_KIND='run'
readonly RUN_COL_PID=10 RUN_COL_PORT=11 RUN_COL_STATUS=12 RUN_COL_STARTED=13 RUN_COL_CODE=14 RUN_COL_ERR=15
# 启动方式的取值与命令行一致；页面按这个直接改参数。
readonly WEB_MODES='auto compile no-compile rebuild'
# 引擎进程里预留的那一次启动：预排行、运行号、服务 id、会话代次。只有引擎会用。
# 状态文件里当前行的位置，web_locate 与 web_set 靠它。
WEB_AT=0
FRAG=()
STATE_WIDTH=0
# 工作区 id 到根的缓存，拼命令时要用。
declare -A WS_ROOTS=()

web_fail() {
  printf 'mvnx: %s\n' "$1" >&2
  return "${2:-$EXIT_FAIL}"
}

# 打印可用的 python3 解释器；没有或太旧就报错。只支持标准库，3.7 起够用。
web_python() {
  local runner=${MVNX_PYTHON:-python3} ver
  command -v "$runner" >/dev/null 2>&1 ||
    { web_fail "找不到 $runner，网页模式的转发进程靠它，先装上 python3" "$EXIT_USAGE"; return; }
  ver=$("$runner" -c 'import sys; print(sys.version_info[0] * 10 + sys.version_info[1])' 2>/dev/null) ||
    { web_fail "跑不起 $runner" "$EXIT_USAGE"; return; }
  ((ver >= 37)) || { web_fail '网页模式需要 python 3.7 或更新版本' "$EXIT_USAGE"; return; }
  printf '%s\n' "$runner"
}

# ---- 状态文件 ----

# 状态目录连同锁目录的上一级一起建：首次使用还没有这个目录，锁就永远拿不到。
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
  # 拿锁这一段在 $(...) 里跑，set -e 会关掉；手动开回来，锁后的失败才不会一路走到底。
  set -e
}

web_unlock() {
  rmdir "$WEB_LOCK_DIR" 2>/dev/null
  return 0
}

# 整份替换写：读的人要么看到旧的整份，要么看到新的整份。
web_write_lines() {
  local tmp="$WEB_STATE_FILE.tmp"
  printf '%s\n' "$@" >"$tmp" && mv -f "$tmp" "$WEB_STATE_FILE"
}

# 只收形状认得出的行：首列决定后面有几列，写坏的行丢掉，不让一行打乱整份状态。
web_state_load() {
  local line want
  STATE_LINES=()
  [[ -f "$WEB_STATE_FILE" ]] || return 0
  # 循环体一律执行，别用 && 串：跳过的条件会悄悄吃掉最后一行。
  while IFS= read -r line; do
    case ${line%%"$FS"*} in
      "$WS_KIND"|"$POM_KIND") want=4 ;;
      "$SVC_KIND") want=9 ;;
      "$RUN_KIND") want=16 ;;
      *) continue ;;
    esac
    web_split "$line"
    ((STATE_WIDTH == want)) && STATE_LINES+=("$line")
  done <"$WEB_STATE_FILE"
}

web_state_save() {
  web_write_lines "${STATE_LINES[@]+"${STATE_LINES[@]}"}"
}

# 按列号切行：第 N 段的 [[:start:N]] 填进 FRAG[N]（N 从 0 起，0 段是首列）。
# $FS 内部没有通配、不是正则、不是反斜杠，当分隔符用是准的；一行只切一次，
# 不在一行里反复套 $(...)，那种写法会把行末换行带进来，后面几列全串位。
web_split() {
  local line=$1 i want=0
  local -a parts=()
  FRAG=()
  IFS="$FS" read -r -a parts <<<"$line"
  for i in "${!parts[@]}"; do FRAG[i]=${parts[i]}; done
  # 末尾的空列 read 会吞掉，按记录类型补齐。
  case ${line%%"$FS"*} in
    "$WS_KIND"|"$POM_KIND") want=4 ;;
    "$SVC_KIND") want=9 ;;
    "$RUN_KIND") want=16 ;;
    *) want=$((${#parts[@]} + 1)) ;;
  esac
  for ((i = ${#parts[@]}; i < want; i++)); do FRAG[i]=''; done
  STATE_WIDTH=$want
}

# 取第 n 列（1 起），空列也认。
web_col() {
  # $1 是整行，$2 是第几列（1 起）。数组下标取负是「从末尾数」，
  # 末尾的空列 bash 会留着，所以 : -2 就是倒数第二列，用不着数总列数。
  local n cell
  web_split "$1"
  # 先减到局部变量再当下标：算术里直接放 $2 时，后面接着访问数组会读错格。
  n=$2
  n=$((n - 1 - STATE_WIDTH))
  # 不能用 ${FRAG[$n]}：set -u 下 bash 只认字面下标，变量下标会被当成「未定义」。
  cell=${FRAG[0]}
  [[ "$n" != '0' ]] && eval "cell=\${FRAG[$n]}"
  printf '%s\n' "$cell"
}

# 换掉一行里若干列，结果打到标准输出：列号 值 列号 值 ……，列数以该行的类型为准。
web_row_set() {
  local line=$1
  shift
  local -A want=()
  while (($# >= 2)); do
    want[$1]=$2
    shift 2
  done
  web_split "$line"
  local n=$STATE_WIDTH i out='' v
  for ((i = 0; i < n; i++)); do
    v=${FRAG[i]}
    ((i > 0)) && out+="$FS"
    [[ -n "${want[i + 1]+x}" ]] && v=${want[i + 1]}
    out+="$v"
  done
  printf '%s\n' "$out"
}

# 换掉 STATE_LINES[WEB_AT] 里的若干列，配合 web_locate 用。
web_set() {
  STATE_LINES[WEB_AT]=$(web_row_set "${STATE_LINES[WEB_AT]}" "$@")
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

# ---- 工作区 ----

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

# 从目录往上找第一个带 pom.xml 的目录，它就是工作区根；一路找不到就不是 Maven 项目。
web_ws_root() {
  local dir
  dir=$(cd "$1" 2>/dev/null && pwd) || return 1
  while :; do
    [[ -f "$dir/pom.xml" ]] && { printf '%s\n' "$dir"; return 0; }
    [[ "$dir" == '/' ]] && return 1
    dir=$(parent_dir "$dir")
  done
}

# 加工作区：已登记过的同一根只重扫，历史运行记录保留。
web_ws_add() {
  local root id dir=$1
  dir=$(cd "$dir" 2>/dev/null && pwd) || { web_fail "目录不存在：$dir" "$EXIT_USAGE"; return 1; }
  root=$(web_ws_root "$dir") || { web_fail "$dir 及其上级都没有 pom.xml，不是 Maven 项目" "$EXIT_USAGE"; return 1; }
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

# 删一个工作区，连同它的服务、pom、运行记录与日志；还在跑的进程先停掉。
web_ws_remove() {
  local id=$1 row pid status
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
    web_state_save
  fi
  web_unlock
  rm -rf "${WEB_LOG_DIR:?}/$id"
}

# ---- 扫描 ----

# 一条服务写成 svc 行。参数：工作区 id、类型、id 尾、执行目录、-pl 的值、mvn 参数、展示路径、展示命令。
web_svc_line() {
  printf '%s\n' "$SVC_KIND$FS$1.$2.$3$FS$1$FS$2$FS$4$FS$6$FS$5$FS$7$FS$8"
}

# 现扫一个工作区，结果逐行打到标准输出，不碰状态文件。
# run、war、package 的收集器与命令行同源；install 按子模块列，与命令行的清单一致。
web_scan() {
  local id=$1 root=$2
  local rec tag workdir plpath mvnargs display cmdtext sub pom args

  prepare_scan "$root"

  while IFS= read -r rec; do
    # 收集器给的是六列记录：标签、工作目录、-pl 的值、mvn 参数、展示路径、展示命令。
    IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$rec"
    web_svc_line "$id" run "$tag" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
    # 能启动的模块都给一条打包：同一模块上的两个动作，参数由 package 现拼。
    args=$(package_args)
    web_svc_line "$id" package "$tag" "$workdir" "$plpath" "$args" "$display" "mvn${plpath:+ -pl "$plpath"} $args"
  done < <(collect_runnable | assign_tags)

  while IFS= read -r rec; do
    IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$rec"
    web_svc_line "$id" war "$tag" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
  done < <(collect_war | assign_tags)

  while IFS= read -r rec; do
    IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$rec"
    while IFS= read -r sub; do
      # 子模块的六列：标签、工作目录、-pl 的值、mvn 参数、展示路径、展示命令。
      IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$sub"
      web_svc_line "$id" install "$tag" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
    done < <(emit_project_modules "$workdir" "$tag")
  done < <(collect_toplevel | assign_tags)

  # pom 清单给页面的模块下拉用。
  while IFS= read -r pom; do
    printf '%s\n' "$POM_KIND$FS$pom$FS$id$FS${pom#"$root"/}"
  done < <(scan_poms "$root")
  return 0
}

# 用一个工作区的扫描结果替换旧的服务与 pom 行；工作区与运行记录原样保留。
# 按服务 id 记下旧值，新扫出来的同一服务沿用，命令行也按新值重拼。
web_scan_apply() {
  local id=$1 file=$2 row line sid module args root pl rel
  local -a fresh=() keep=() out=()
  local -A saved=()
  [[ -s "$file" ]] && mapfile -t fresh <"$file"
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    if [[ ${row%%"$FS"*} == "$SVC_KIND" ]] && [[ "$(web_col "$row" 3)" == "$id" ]]; then
      saved[$(web_col "$row" 2)]=$(web_col "$row" 6)$FS$(web_col "$row" 7)
    fi
  done
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    case ${row%%"$FS"*} in
      "$SVC_KIND"|"$POM_KIND") [[ "$(web_col "$row" 3)" == "$id" ]] && continue ;;
    esac
    keep+=("$row")
  done
  root=''
  web_locate "$WS_KIND" "$id" && root=$(web_col "$WEB_ROW" 3)
  for line in "${fresh[@]+"${fresh[@]}"}"; do
    if [[ ${line%%"$FS"*} == "$SVC_KIND" ]]; then
      sid=$(web_col "$line" 2)
      if [[ -n "${saved[$sid]+x}" ]]; then
        module=$(web_col "${saved[$sid]}" 1)
        args=$(web_col "${saved[$sid]}" 2)
        [[ -n "$module" ]] && line=$(web_row_set "$line" 6 "$module")
        [[ -n "$args" ]] && line=$(web_row_set "$line" 7 "$args")
        rel=''
        if [[ -n "$module" ]] && [[ "$(web_col "$line" 5)" != "$root" ]]; then
          rel="$(basename "$(web_col "$line" 5)")/"
        fi
        pl=''
        [[ -n "$module" ]] && pl=" -pl $rel$module"
        line=$(web_row_set "$line" 9 "mvn$pl $args")
      fi
    fi
    out+=("$line")
  done
  STATE_LINES=("${keep[@]+"${keep[@]}"}" "${out[@]+"${out[@]}"}")
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

# ---- 运行记录 ----

# 一次运行的日志：<日志目录>/<工作区>/<运行号>.log；python 起进程时同一路径收起输出。
# 失败与正常结束会单独写一个 .code，内容是进程退出码，命令行那边看不到进程了就靠它判结果。
web_log_file() {
  printf '%s/%s/%s.log\n' "$WEB_LOG_DIR" "$1" "$2"
}

# 会话里还有没有活着的 mvn 或 java：bash -> mvn -> java 一层层都看过才敢说跑完了。
# 先看行尾的会话号：号在最后，两个快捷删除一取就准，不用空格切；再看名字，别的一律不算。
web_session_alive() {
  local sid=$1 line rest
  [[ "$sid" =~ ^[0-9]+$ ]] || return 1
  while IFS= read -r line; do
    # 行形如 " 162097 sleep 300"：去掉前导空白，开头那段就是会话号。
    rest=${line#"${line%%[![:space:]]*}"}
    [[ "${rest%%[[:space:]]*}" == "$sid" ]] || continue
    # 会话里跑的就是 mvn（或者它拉起的 java），别的进程混进来不算数。
    return 0
  done < <(ps -e -o sid= -o args= 2>/dev/null)
  return 1
}

# 进程组还在不在。
web_group_alive() {
  local pgid=${1:-}
  [[ "$pgid" =~ ^[0-9]+$ ]] || return 1
  kill -0 -- "-$pgid" 2>/dev/null
}

# 从日志里找服务端口：Tomcat 与 Jetty 启动时都会打一行。
# 正则先放变量里：直接用 [[ =~ ]] 写带空格的分支，bash 会报语法错。
web_detect_port() {
  local file=$1 text re_pair re_any port
  [[ -f "$file" ]] || return 1
  text=$(tail -n 60 "$file" 2>/dev/null)
  re_pair='(Tomcat|Jetty) started on port\(s\)?: ?([0-9]+)'
  re_any='https?://[^ \t]*:([0-9]{2,5})'
  if [[ "$text" =~ $re_pair ]]; then
    port=${BASH_REMATCH[2]}
  elif [[ "$text" =~ $re_any ]]; then
    port=${BASH_REMATCH[1]}
  else
    return 1
  fi
  [[ -n "$port" ]] && printf '%s\n' "$port"
}

# 日志里第一条 [ERROR]，页面直接展示，省得去翻日志。
web_error_text() {
  local file=$1 line
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    [[ "$line" == *'[ERROR]'* ]] || continue
    line=${line#*[ERROR]}
    line=${line#"${line%%[![:space:]]*}"}
    printf '%s\n' "${line:0:300}"
    return 0
  done <"$file"
}

# python 写的退出码文件。
web_exit_code() {
  local code
  code=$(<"$1.code" 2>/dev/null) || return 0
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

  # 进程没了：等一小会儿让 python 把退出码写完再判，免得读了个空。
  while ((waited < 20)) && [[ ! -f "$file.code" ]]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  code=$(web_exit_code "$file")
  err=$(web_error_text "$file")
  if [[ -n "$code" ]]; then
    web_set "$RUN_COL_PID" '' "$RUN_COL_CODE" "$code" "$RUN_COL_ERR" "$err"
    # 打包安装跑完就是结束；服务类自己退出算意外退出，页面用好坏码区分。
    if [[ "$code" == '0' ]]; then
      web_set "$RUN_COL_STATUS" exited
    else
      web_set "$RUN_COL_STATUS" failed
    fi
  else
    # 退出码还没写下来（页面刚点到就刷新过），先按停止算。
    web_set "$RUN_COL_PID" '' "$RUN_COL_STATUS" stopped
  fi
  return 0
}

# 收拾一遍在跑的记录，页面每隔两秒调一次。
# 只看 status 是 starting/ready 的那几行，别的一律不碰，历史记录一直留着。
web_poll() {
  local ws=$1 row idx changed=0 status
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

# 把它算好的参数换成页面给的 -pl：参数里不出现 -pl，模块单列存放，执行时才拼成 -pl 参数，路径带空格也不拆。
web_args_no_pl() {
  local args=$1 out='' word skip=0
  local -a words=()
  read -r -a words <<<"$args"
  for word in "${words[@]}"; do
    if ((skip)); then
      skip=0
      continue
    fi
    [[ "$word" == '-pl' || "$word" == '--projects' ]] && { skip=1; continue; }
    out+="${out:+ }$word"
  done
  printf '%s\n' "$out"
}

# 拼 mvn 参数。参数：类型、模块、服务自带参数、附加参数、启动方式、执行目录。
# run 与 war 是服务：自动判定在选中的模块上做，与命令行同一套规则。install 与 package 跑完就结束。
web_launch_args() {
  local type=$1 module=$2 args=$3 extra=$4 mode=$5 dir=$6
  # 这里是 $(...)，提示别打 stdout，回话会跟着乱；失败靠返回值说话。
  args=$(web_args_no_pl "$args")
  if [[ -n "$extra" ]]; then args+=" $extra"; fi
  case "$type" in
    run|war)
      case "$mode" in
        rebuild) args="clean $args" ;;
        compile) args+=" $SKIP_ARGS" ;;
        no-compile)
          if [[ -n "$module" ]] && [[ ! -d "$dir/$module/target/classes" ]]; then
            printf 'mvnx: 「%s」没有 target/classes，先编译或改用重新编译\n' "$module" >&2
            return 1
          fi
          args+=" $SKIP_ARGS"
          ;;
        *)
          # 模块给了就按模块判，没给就按服务自己的目录；没动过源码就跳过编译，与命令行一致。
          if ! needs_compile "${dir}${module:+/$module}"; then
            args+=" $SKIP_ARGS"
          fi
          ;;
      esac
      ;;
    *)
      [[ "$mode" == 'rebuild' ]] && args="clean $args"
      ;;
  esac
  printf '%s\n' "$args"
}

# 展示用的命令：工作目录是服务自己的目录，-pl 要按它算相对路径，直接把模块名塞进 -pl 是错的。
# 参数：模块（相对工作区根）、服务目录、工作区根、mvn 参数。
web_cmd_text() {
  local module=$1 dir=$2 root=$3 args=$4 rel='' pl=''
  if [[ -n "$module" ]]; then
    [[ "$dir" != "$root" ]] && rel="${dir#"$root"/}/"
    pl=" -pl $rel$module"
  fi
  printf 'mvn%s %s\n' "$pl" "$args"
}

# 服务 id 形如 <工作区>.<类型>.<标签>；标签里可能还有点和斜杠，所以标签取第三段起。
web_tag() {
  local id
  id=$(web_col "$1" 2)
  printf '%s\n' "${id#*.*.}"
}

# 一条 run 行：run|id|ws|type|tag|path|display|pl|args|cmd|pid|port|status|started|code|err
web_run_line() {
  local svc=$1 id=$2 pid=$3 module=$4 args=$5 cmd
  # 先各取各的：${:-} 里带引号时会把后面的替换一起吞进去，拼出来的命令错位。
  local ws type tag path display root rel
  ws=$(web_col "$svc" 3)
  type=$(web_col "$svc" 4)
  tag=$(web_tag "$svc")
  path=$(web_col "$svc" 5)
  display=$(web_col "$svc" 8)
  root=$(web_ws_root_of "$ws")
  # -pl 相对服务自己的目录算，这里直接拼好，不再套一层命令行。
  rel=''
  if [[ -n "$module" ]]; then
    [[ "$path" != "$root" ]] && rel="${path#"$root"/}/"
    rel=" -pl $rel$module"
  fi
  cmd="mvn$rel $args"
  # 一行一行拼：长替换串里嵌 $FS 容易被吞，踩过一次。
  local out="$RUN_KIND$FS$id$FS$ws$FS$type$FS$tag$FS$path$FS$display$FS$module$FS$args$FS$cmd$FS$pid"
  local now
  now=$(date +%s)
  printf '%s\n' "$out$FS$FS'starting'$FS$now$FS$FS"
}

# 预排交给引擎：写进临时文件并回一个代次，引擎读走后删掉。
web_pend_save() {
  local gen
  gen=$(date +%s%N)
  printf '%s\n%s\n' "$1" "$2" >"$WEB_PEND_FILE" || return 1
  printf '%s\n' "$gen"
}

# 读回预排：运行号在前，整行在后；读完就删，一次启动只认一次。
web_pend_load() {
  [[ -s "$WEB_PEND_FILE" ]] || return 1
  { IFS= read -r PEND_RUN && IFS= read -r PEND_LINE; } <"$WEB_PEND_FILE" || rm -f "$WEB_PEND_FILE"
  rm -f "$WEB_PEND_FILE"
  [[ -n "$PEND_LINE" ]]
}

# 启动的第一半：拼参数，把运行号、执行目录、mvn 参数、预排好的一行交回 python。
# 运行号是服务 id 接时间，同一服务反复启动时日志按运行号分开。
# 预排那一行此刻不落盘：进程还没起来，会话号得等 python 起好再回填。
# 发起处是 out=$(web_reserve ...)：$( ) 是子进程，在这里设的 PEND_* 带不回引擎，
# 所以回话里夹带一个临时文件，引擎读走后再由 web_launched 从这里取。
web_reserve() {
  local id=$1 module=${2:-} extra=${3:-} mode=${4:-} svc path args runid line gen
  [[ -n "$mode" ]] || mode=auto
  # 进锁、读状态、找服务在锁里做完；后面拼参数要看 target 目录，快，就不用一直占着锁。
  # 外面是 $(...)，中途失败要自己放锁，锁才不会黏住。
  web_lock || return
  web_state_load
  if ! web_locate "$SVC_KIND" "$id"; then
    web_unlock
    printf 'mvnx: 没有这个服务：%s\n' "$id" >&2
    return 1
  fi
  svc=$WEB_ROW
  web_unlock

  # 各列先落到局部变量：$(...) 里再套 $(...) 时，替换结果里残留的换行会让后面几列串位。
  local type base
  type=$(web_col "$svc" 4)
  path=$(web_col "$svc" 5)
  base=$(web_col "$svc" 7)
  args=$(web_launch_args "$type" "$module" "$base" "$extra" "$mode" "$path") || return
  runid="$id.$(date +%s%N)"
  line=$(web_run_line "$svc" "$runid" '' "$module" "$args")

  # 预排行与运行号交给引擎暂存，代次用来认出「这一次启动」。
  gen=$(web_pend_save "$runid" "$line") || return

  # 回话：ok、运行号、执行目录、mvn 参数、预排行、代次。
  printf '%s\n' "ok$FS$runid$FS$path$FS$args$FS$line$FS$gen"
  return 0
}

# 启动的第二半：python 起好进程送回会话号，这里把会话号填进预排行再落盘。
web_launched() {
  local sid=$1 gen=$2 line out='' i v
  # 预排是 reserve 留下的临时文件，谁先读到算谁的；读不到说明已经作废或被人收走。
  web_pend_load || { printf 'mvnx: 这次启动已作废\n' >&2; return 1; }
  for ((i = 1; i <= 15; i++)); do
    v=$(web_col "$PEND_LINE" "$i")
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

# 服务行上的参数改动：模块与 mvn 参数，页面改一处存一处。
web_txn_svc_set() {
  local id=$1 module=$2 args=$3 path root cmd
  web_locate "$SVC_KIND" "$id" || return 1
  path=$(web_col "$WEB_ROW" 5)
  root=$(web_ws_root_of "$(web_col "$WEB_ROW" 3)")
  cmd=$(web_cmd_text "$module" "$path" "$root" "$args")
  web_set 6 "$module" 7 "$args" 9 "$cmd"
}

web_update() {
  local id=$1 module=$2 args=$3
  web_txn web_txn_svc_set "$id" "$module" "$args"
}


# ---- web 命令 ----

# 引擎：接住 python 递过来的请求流，一条请求一行。
# 请求走标准输入、回话走标准输出，都按行、$FS 分列：先回一行 ok，有数据时紧跟第二行。
# 页面每两秒来一条 tick，顺手把在跑的记录收拾一遍，页面看到的就是最新状态。
web_engine() {
  local line req op out rc
  if ! IFS= read -r line <&0 || [[ "$line" != "hello$FS"* ]]; then
    web_fail '控制通道握手不对，网页服务与 mvnx 版本不一致'
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
      reserve) out=$(web_reserve "$(web_col "$req" 2)" "$(web_col "$req" 3)" "$(web_col "$req" 4)" "$(web_col "$req" 5)") || rc=$? ;;
      launched) web_launched "$(web_col "$req" 2)" "$(web_col "$req" 3)" || rc=$? ;;
      stop) web_stop "$(web_col "$req" 2)" || rc=$? ;;
      update) web_update "$(web_col "$req" 2)" "$(web_col "$req" 3)" "$(web_col "$req" 4)" || rc=$? ;;
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

# mvnx web：起 python，等它就绪，然后就守着它；Ctrl+C 连 python 一起带走。
# python 起了它之后一直走管道递请求，实际的动作都在这个进程里跑，扫描结果也一直留着。
web_command() {
  local runner child log line='' waited=0 ans url local_url
  local -a open_arg=()
  runner=$(web_python) || return
  RV_PORT=${RV_PORT:-0}
  RV_HOST=${RV_HOST:-0.0.0.0}
  [[ "$RV_PORT" =~ ^[0-9]+$ ]] && ((RV_PORT >= 0 && RV_PORT <= 65535)) ||
    { web_fail "端口不对：$RV_PORT" "$EXIT_USAGE"; return; }
  [[ -f "$WEB_PAGE" ]] ||
    { web_fail "缺 ${WEB_PAGE#"$mvnx_dir"/}，前端还没打包（见 mvnx/web/README.md）" "$EXIT_USAGE"; return; }

  mkdir -p "$WEB_HOME" "$WEB_LOG_DIR"
  log="$WEB_HOME/runner.log"
  : >"$log"
  ((RV_OPEN)) && open_arg+=(--open)

  "$runner" "$mvnx_dir/mvnx/web/server.py" \
    --static "$mvnx_dir/mvnx/web/static" \
    --state "$WEB_STATE_FILE" --logs "$WEB_LOG_DIR" --api "$WEB_API_PREFIX" \
    --mvnx "${MVNX_SELF:-$mvnx_dir/../bin/mvnx}" \
    --host "$RV_HOST" --port "$RV_PORT" "${open_arg[@]}" >"$log" 2>&1 &
  child=$!
  # Ctrl+C 与正常退出都把 python 带走；正在跑的 mvn 在它自己的会话里，不跟着停。
  trap 'kill -TERM "$child" 2>/dev/null' INT TERM HUP

  # 地址由 python 选好再报上来：端口是 0 时它报的是实际用的那个。
  while ((waited < WEB_ATTACH_TIMEOUT * 4)); do
    if ans=$(grep -m 1 '^MVNX_WEB_READY ' "$log" 2>/dev/null); then
      line=${ans#MVNX_WEB_READY }
      break
    fi
    kill -0 "$child" 2>/dev/null || { web_fail "网页服务起不来：$(tail -n 3 "$log" 2>/dev/null)"; return; }
    sleep 0.25
    waited=$((waited + 1))
  done
  [[ -n "$line" ]] || { web_fail '等网页服务就绪超时'; return; }

  # python 报上来的是「主机:端口」：端口填 0 时它是实际用上的那个，绑所有网卡时主机是猜出来的局域网地址。
  url="http://$line/"
  local_url="http://127.0.0.1:${line##*:}/"
  if ((JSON_ONLY)); then
    printf '{"url":"%s","local":"%s","host":"%s","port":"%s"}\n' \
      "$url" "$local_url" "$RV_HOST" "${line##*:}"
    return 0
  fi
  printf 'mvnx 网页界面：%s\n' "$url"
  [[ "$url" == "$local_url" ]] || printf '本机 %s\n' "$local_url"
  # 页面没有登录：能连上的人都能起停服务，这一点得说在前面。
  [[ "$RV_HOST" == '127.0.0.1' || "$RV_HOST" == 'localhost' ]] ||
    printf '页面没有登录，同一网络里能连上的人都能启停服务；只想本机用就加 --host 127.0.0.1\n' >&2
  printf '按 Ctrl+C 退出网页服务；正在跑的 mvn 在自己会话里，不跟着停，可在网页里停。\n' >&2
  wait "$child"
}
