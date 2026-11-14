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
# mvnx web 起 python 后最多等这么多秒；到时还没起来就算启动失败。
readonly WEB_ATTACH_TIMEOUT=20

readonly WEB_HOME="$CACHE_DIR/web"
readonly WEB_STATE_FILE="$WEB_HOME/state.tsv"
readonly WEB_LOCK_DIR="$WEB_HOME/lock"
# 锁目录里记一个持有者：拿锁的进程没了，这个锁就作废，不用等人来删。
readonly WEB_LOCK_PID="$WEB_LOCK_DIR/pid"
# reserve 与 launched 之间交接预排行的临时文件。
readonly WEB_PEND_FILE="$WEB_HOME/pending"
readonly WEB_LOG_DIR="$WEB_HOME/logs"
readonly WEB_PAGE="$mvnx_dir/mvnx/web/static/index.html"
# 接口挂在单独的前缀下，HttpOnly 的 Cookie 只认 Path，前缀对得上才随请求上来。
readonly WEB_API_PREFIX='/__mvnx/api'

# 状态行首列决定这是什么，读写两侧照这张表：
#   ws  |id|root|added
#   svc |id|ws|type|path|pl|args|display|cmd
#   pom |id|ws|rel
#   run |id|ws|type|tag|path|pl|display|module|args|cmd|pid|port|status|started|code|err
# run 的 status 取 starting、ready、exited、failed、stopped；pid 是它的会话号，也是进程组号。
readonly WS_KIND='ws' SVC_KIND='svc' POM_KIND='pom' RUN_KIND='run'
readonly RUN_COL_PID=12 RUN_COL_PORT=13 RUN_COL_STATUS=14 RUN_COL_STARTED=15 RUN_COL_CODE=16 RUN_COL_ERR=17
# run 行共 17 段：类型、运行号，加下面这 15 个字段。
# 共享状态层按这张表判断一行该有几列；键是首列的类型。
declare -A WEB_STATE_WIDTHS=([ws]=4 [pom]=4 [svc]=9 [run]=17)

# 工作区

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
# 扫描

# 一条服务写成 svc 行。参数：工作区 id、类型、id 尾、执行目录、-pl 的值、mvn 参数、展示路径、展示命令。
# 一条服务行：ws|类型|工作目录|-pl 的值|mvn 参数|展示路径|展示命令，前面接 id 与类型。
web_svc_line() {
  # 收的是六列记录：标签、工作目录、-pl 的值、mvn 参数、展示路径、展示命令。
  # 存的是九段：类型、服务 id、工作区、动作、工作目录、-pl 的值、mvn 参数、展示路径、展示命令。
  printf '%s\n' "$SVC_KIND$FS$1.$2.$3$FS$1$FS$2$FS$4$FS$5$FS$6$FS$7$FS$8"
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
  done < <(collect_runnable | shell_assign_tags)

  while IFS= read -r rec; do
    IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$rec"
    web_svc_line "$id" war "$tag" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
  done < <(collect_war | shell_assign_tags)

  while IFS= read -r rec; do
    IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$rec"
    while IFS= read -r sub; do
      # 子模块的六列：标签、工作目录、-pl 的值、mvn 参数、展示路径、展示命令。
      IFS="$FS" read -r tag workdir plpath mvnargs display cmdtext <<<"$sub"
      web_svc_line "$id" install "$tag" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
    done < <(emit_project_modules "$workdir" "$tag")
  done < <(collect_toplevel | shell_assign_tags)

  # pom 清单给页面的模块下拉用。
  while IFS= read -r pom; do
    printf '%s\n' "$POM_KIND$FS$pom$FS$id$FS${pom#"$root"/}"
  done < <(scan_poms "$root")
  return 0
}

# 用一个工作区的扫描结果替换旧的服务与 pom 行；工作区与运行记录原样保留。
# 按服务 id 记下旧值，新扫出来的同一服务沿用，命令行也按新值重拼。
web_scan_apply() {
  local id=$1 file=$2 row line sid module args root pl dir width _sid _pl _ga
  local -a fresh=() keep=() out=()
  local -A saved=()
  [[ -s "$file" ]] && mapfile -t fresh <"$file"
  for row in "${STATE_LINES[@]+"${STATE_LINES[@]}"}"; do
    if [[ ${row%%"$FS"*} == "$SVC_KIND" ]] && [[ "$(web_col "$row" 3)" == "$id" ]]; then
      # 记旧值：-pl 的值在第 6 列、mvn 参数在第 7 列。
      # 一行里连套三个 $(web_col ...) 会串位，先各取各的。
      _sid=$(web_col "$row" 2)
      _pl=$(web_col "$row" 6)
      _ga=$(web_col "$row" 7)
      saved[$_sid]="$_pl$FS$_ga"
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
        web_split "$line"
        width=$STATE_WIDTH
        # 旧值同样是「-pl 的值|mvn 参数」；页面上改过的是参数，模块位按 -pl 的值放回去。
        pl=${saved[$sid]%%"$FS"*}
        args=${saved[$sid]#*"$FS"}
        dir=$(web_col "$line" 5)
        # 服务行九段：第 6 列是 -pl 的值、第 7 列是 mvn 参数、第 9 列是展示命令。
        # 命令照更新参数时的同一套拼法，两处拼出来的才对得上。
        line=$(web_row_set "$width" "$line" 6 "$pl" 7 "$args" \
          9 "$(web_cmd_text "$pl" "$dir" "$root" "$args")")
      fi
    fi
    out+=("$line")
  done
  STATE_LINES=("${keep[@]+"${keep[@]}"}" "${out[@]+"${out[@]}"}")
}

# 扫一个已登记的工作区并合并结果。扫描要几秒，不持锁扫，只在写回时锁一次。

# 运行记录

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

web_group_alive() {
  local pgid=${1:-}
  [[ "$pgid" =~ ^[0-9]+$ ]] || return 1
  kill -0 -- "-$pgid" 2>/dev/null
}

# 从日志里找服务端口：Tomcat 与 Jetty 启动时都会打一行。
# 正则先放变量里，直接在 [[ =~ ]] 里写带空格的分支会报语法错；URL 只认本机地址，仓库与 Nexus 地址不是服务端口。
web_detect_port() {
  local file=$1 text re_pair re_any port line
  [[ -f "$file" ]] || return 1
  text=$(tail -n 60 "$file" 2>/dev/null)
  # 「port 8080」「port(s): 8080」「ports: 8080」三种写法都要认：
  # (s) 与 s 各自可选，冒号也可选；端口落在第 3 个分组。
  re_pair='(Tomcat|Jetty) started on port(\(s\)|s)?:? ?([0-9]+)'
  re_any='https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):([0-9]{2,5})'
  while IFS= read -r line; do
    if [[ "$line" =~ $re_pair ]]; then
      printf '%s\n' "${BASH_REMATCH[3]}"
      return 0
    fi
  done <<<"$text"
  while IFS= read -r line; do
    [[ "$line" == *'/repository/'* || "$line" == *'from the repositories'* ]] && continue
    if [[ "$line" =~ $re_any ]]; then
      printf '%s\n' "${BASH_REMATCH[2]}"
      return 0
    fi
  done <<<"$text"
  return 1
}

# 日志里第一条 [ERROR]，页面直接展示，省得去翻日志。
web_error_text() {
  local file=$1 line
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    [[ "$line" == *'[ERROR]'* ]] || continue
    # 去掉前缀 '[ERROR]'：不转义时它是 glob 的字符类，只会吃掉一个字母。
    line=${line#*'[ERROR]'}
    line=${line#"${line%%[![:space:]]*}"}
    printf '%s\n' "${line:0:300}"
    return 0
  done <"$file"
}

# python 写的退出码文件。
web_exit_code() {
  local code
  # $(<文件) 只有「命令替换里光有一个重定向」才是读文件；再挂 2>/dev/null 就成了一条
  # 只有重定向的空命令，输出永远为空。错误重定向要放到替换外面。
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


# 启动

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
  local ws type tag path display root rel pl
  ws=$(web_col "$svc" 3)
  type=$(web_col "$svc" 4)
  tag=$(web_tag "$svc")
  path=$(web_col "$svc" 5)
  # 第 6 列是 -pl 的值，运行行也得照着服务行的列序留这一格，少一格后面全串位。
  pl=$(web_col "$svc" 6)
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
  # 列序：类型|运行号|工作区|服务类型|标签|工作目录|-pl 的值|展示路径|模块|参数|命令|会话号|端口|状态|开始|退出码|错误
  local out="$RUN_KIND$FS$id$FS$ws$FS$type$FS$tag$FS$path$FS$pl$FS$display$FS$module$FS$args$FS$cmd$FS$pid$FS"
  # 别的值都进变量再拼；单引号夹在串里会原样落进状态文件，读回来状态就不认了。
  local starting_state='starting'
  local now
  now=$(date +%s)
  # $out 到会话号为止且末尾带一个分隔符，端口这一格此刻还是空的，再补一个分隔符占位。
  printf '%s\n' "$out$FS$starting_state$FS$now$FS$FS"
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

# 启动的第一半：拼参数，把运行号、执行目录、mvn 参数、预排行交回 python。
# 运行号是服务 id 接时间；$( ) 是子进程，PEND_* 带不回引擎，所以用临时文件交接，由 web_launched 取走。
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
  # 按整行实际宽度走：末尾两列本来就是空的，循环少了会丢列，多了会多出分隔符。
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


# web 命令

# 引擎：接住 python 递过来的请求流，一条请求一行；先回一行 ok，有数据时紧跟第二行。
# 页面每两秒来一条 tick，顺手把在跑的记录收拾一遍。
web_engine() {
  local line req op out rc _id _mod _extra _mode
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
      reserve)
        # 先各取各的：一行里连套几个 $(...) 时，后面的会把前面的参数带乱。
        _id=$(web_col "$req" 2); _mod=$(web_col "$req" 3); _extra=$(web_col "$req" 4); _mode=$(web_col "$req" 5)
        out=$(web_reserve "$_id" "$_mod" "$_extra" "$_mode") || rc=$?
        ;;
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

# web_command 的公共流程在 lib/shell-shared/web-command.sh，这里只给参数。
WEB_TOOL='mvnx'
WEB_ROOT="$mvnx_dir/mvnx/web"
WEB_SERVER_PY="$WEB_ROOT/server.py"
WEB_STATIC_DIR="$WEB_ROOT/static"
WEB_READY_MARKER='MVNX_WEB_READY'
WEB_PYTHON_ENV='MVNX_PYTHON'
# --json 时只打一行 JSON；mvnx 的 JSON 分支不 wait，交给调用方接着用。
WEB_JSON_FLAG=0
WEB_JSON_WAIT=0
WEB_SERVER_ARGS=(
  --state "$WEB_STATE_FILE" --logs "$WEB_LOG_DIR" --api "$WEB_API_PREFIX"
  --mvnx "${MVNX_SELF:-$mvnx_dir/../bin/mvnx}"
)
WEB_WARN_TEXT='页面没有登录，同一网络里能连上的人都能启停服务；只想本机用就加 --host 127.0.0.1'
WEB_EXIT_TEXT='按 Ctrl+C 退出网页服务；正在跑的 mvn 在自己会话里，不跟着停，可在网页里停。'
