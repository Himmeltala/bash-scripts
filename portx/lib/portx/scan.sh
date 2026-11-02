# 端口发现与进程信息：ss/lsof 查询、进程详情、全端口扫描与结束进程。

is_protected() {
  local port=$1
  ((port <= PRIVILEGED_MAX)) && return 0
  [[ -n ${PROTECTED_SET[$port]:-} ]] && return 0
  return 1
}

protect_reason() {
  if (($1 <= PRIVILEGED_MAX)); then
    printf '特权端口段 0 到 %d' "$PRIVILEGED_MAX"
  else
    printf '在受保护名单里'
  fi
}

# 查一个端口，结果写全局：监听行、协议、pid。
# 返回 0 拿到 pid，1 没人监听，2 有监听但对不上进程。
SOCKET_LINES=()
SOCKET_PROTOS=()
QUERY_PIDS=''

discover_port() {
  local port=$1 lines=() extra=() i
  SOCKET_LINES=()
  SOCKET_PROTOS=()
  QUERY_PIDS=''

  if command -v ss >/dev/null 2>&1; then
    mapfile -t lines < <(ss -H -ltnp "sport = :$port" 2>/dev/null)
    for i in "${lines[@]}"; do
      SOCKET_LINES+=("$i")
      SOCKET_PROTOS+=(TCP)
    done
    if ((UDP)); then
      mapfile -t extra < <(ss -H -lunp "sport = :$port" 2>/dev/null)
      for i in "${extra[@]}"; do
        SOCKET_LINES+=("$i")
        SOCKET_PROTOS+=(UDP)
      done
    fi
    ((${#SOCKET_LINES[@]})) || return 1
    QUERY_PIDS=$(printf '%s\n' "${SOCKET_LINES[@]}" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
    [[ -n $QUERY_PIDS ]] || return 2
    return 0
  fi

  if command -v lsof >/dev/null 2>&1; then
    mapfile -t lines < <(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null)
    if ((UDP)); then
      mapfile -t extra < <(lsof -nP -t -iUDP:"$port" 2>/dev/null)
      lines+=("${extra[@]}")
    fi
    if ((${#lines[@]})); then
      QUERY_PIDS=$(printf '%s\n' "${lines[@]}" | grep -E '^[0-9]+$' | sort -u)
    fi
    [[ -n $QUERY_PIDS ]] || return 1
    return 0
  fi

  die '缺少 ss 与 lsof，先装 iproute2 或 lsof'
}

# 给杀进程用，只输出 pid，一行一个。
find_pids() {
  discover_port "$1" || return $?
  printf '%s\n' "$QUERY_PIDS"
}

PID_LINES=()
pid_info_lines() {
  local pid=$1 user name cmd exe cwd
  user=$(stat -c %U "/proc/$pid" 2>/dev/null) || user='?'
  name=$(cat "/proc/$pid/comm" 2>/dev/null) || name='?'
  exe=$(readlink "/proc/$pid/exe" 2>/dev/null) || exe='?'
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || cwd='?'
  # 命令行参数里可能带换行（python3 -c 这类），不压平会把输出的表格冲散
  cmd=$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | tr -s '[:space:]' ' ')
  cmd=${cmd% }
  # 内核线程的 cmdline 是空的，退回 comm
  [[ -n $cmd ]] || cmd=$name
  PID_LINES=(
    "$(printf '  PID %-8s %-10s %s' "$pid" "$user" "$name")"
    "    命令: $cmd"
    "    程序: $exe"
    "    目录: $cwd"
  )
}

describe_pid() {
  pid_info_lines "$1"
  printf '%s\n' "${PID_LINES[@]}"
}

alive_pids() {
  local pid
  for pid in "$@"; do
    kill -0 "$pid" 2>/dev/null && printf '%s\n' "$pid"
  done
  return 0
}

confirm() {
  local reply
  ((ASSUME_YES)) && return 0
  # 非交互环境没人可问，按否处理
  [[ -t 0 ]] || return 1
  printf '%s [y/N] ' "$1" >&2
  read -r reply || return 1
  [[ $reply == [yY] || $reply == [yY][eE][sS] ]]
}

INFO_LINES=()
collect_port_info() {
  local port=$1 pid i state _ _ local _
  INFO_LINES=()
  discover_port "$port"
  local rc=$?
  ((rc == 0)) || return "$rc"

  INFO_LINES+=("端口 $port:")
  if ((${#SOCKET_LINES[@]})); then
    for i in "${!SOCKET_LINES[@]}"; do
      read -r state _ _ local _ <<<"${SOCKET_LINES[$i]}"
      INFO_LINES+=("  ${SOCKET_PROTOS[$i]} $state $local")
    done
  else
    INFO_LINES+=("  TCP 端口 $port")
    ((UDP)) && INFO_LINES+=("  UDP 端口 $port")
  fi

  while read -r pid; do
    [[ -n $pid ]] || continue
    pid_info_lines "$pid"
    INFO_LINES+=("${PID_LINES[@]}")
  done <<<"$QUERY_PIDS"
  return 0
}

query_port() {
  local port=$1
  collect_port_info "$port"
  case $? in
    1)
      info "端口 $port 无监听"
      return 1
      ;;
    2)
      warn "端口 $port 有监听但对不上进程，可能非 root 或端口在别的网络命名空间"
      return 1
      ;;
  esac
  printf '%s\n' "${INFO_LINES[@]}"
  return 0
}

# 取端口对应第一个进程的工作目录，供详情页按 p 进目录用。
port_cwd() {
  local port=$1 pid
  discover_port "$port" || return 1
  pid=${QUERY_PIDS%%$'\n'*}
  [[ -n $pid ]] || return 1
  readlink "/proc/$pid/cwd" 2>/dev/null
}

# 全端口扫描结果：按协议与端口归并，地址和 pid 用 | 分隔。
LP_KEYS=()
LP_SORTED=()
declare -A LP_PROTO=() LP_PORT=() LP_LOCAL=() LP_PIDS=()

lp_add() {
  local proto=$1 local_addr=$2 pid=$3 p key
  p=${local_addr##*:}
  [[ $p =~ ^[0-9]+$ ]] || return 0
  key="$proto:$p"

  if [[ -z ${LP_PORT[$key]:-} ]]; then
    LP_KEYS+=("$key")
    LP_PROTO[$key]=$proto
    LP_PORT[$key]=$p
    LP_LOCAL[$key]=$local_addr
    LP_PIDS[$key]=${pid:-}
    return 0
  fi

  [[ "|${LP_LOCAL[$key]}|" == *"|$local_addr|"* ]] || LP_LOCAL[$key]+="|$local_addr"
  if [[ -n $pid && "|${LP_PIDS[$key]}|" != *"|$pid|"* ]]; then
    LP_PIDS[$key]+="${LP_PIDS[$key]:+|}${pid}"
  fi
}

scan_all_ports() {
  local -a lines=()
  local line state _ _ local_addr pid i
  LP_KEYS=()
  LP_SORTED=()
  LP_PROTO=()
  LP_PORT=()
  LP_LOCAL=()
  LP_PIDS=()

  if command -v ss >/dev/null 2>&1; then
    mapfile -t lines < <(ss -H -ltnp 2>/dev/null)
    for line in "${lines[@]}"; do
      read -r state _ _ local_addr _ <<<"$line"
      if [[ $line =~ pid=([0-9]+) ]]; then pid=${BASH_REMATCH[1]}; else pid=''; fi
      lp_add TCP "$local_addr" "$pid"
    done
    if ((UDP)); then
      mapfile -t lines < <(ss -H -lunp 2>/dev/null)
      for line in "${lines[@]}"; do
        read -r state _ _ local_addr _ <<<"$line"
        if [[ $line =~ pid=([0-9]+) ]]; then pid=${BASH_REMATCH[1]}; else pid=''; fi
        lp_add UDP "$local_addr" "$pid"
      done
    fi
  elif command -v lsof >/dev/null 2>&1; then
    mapfile -t lines < <(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null)
    for ((i = 1; i < ${#lines[@]}; i++)); do
      line=${lines[$i]}
      pid=$(awk '{print $2}' <<<"$line")
      lp_add TCP "$(awk '{print $NF}' <<<"$line")" "$pid"
    done
    if ((UDP)); then
      mapfile -t lines < <(lsof -nP -iUDP 2>/dev/null)
      for ((i = 1; i < ${#lines[@]}; i++)); do
        line=${lines[$i]}
        pid=$(awk '{print $2}' <<<"$line")
        lp_add UDP "$(awk '{print $NF}' <<<"$line")" "$pid"
      done
    fi
  else
    die '缺少 ss 与 lsof，先装 iproute2 或 lsof'
  fi

  if ((${#LP_KEYS[@]})); then
    mapfile -t LP_SORTED < <(
      for key in "${LP_KEYS[@]}"; do
        printf '%s\t%s\n' "${LP_PORT[$key]}" "$key"
      done | sort -n -k1,1 | cut -f2
    )
  fi
}

list_all_ports() {
  local key pids pid user name locals
  scan_all_ports
  if ((${#LP_SORTED[@]} == 0)); then
    info '没有监听端口'
    return 0
  fi

  printf '%-6s %-6s %-24s %-10s %-10s %s\n' '协议' '端口' '监听地址' 'PID' '属主' '程序'
  for key in "${LP_SORTED[@]}"; do
    pids=${LP_PIDS[$key]:-}
    if [[ -n $pids ]]; then
      pid=${pids%%|*}
      user=$(stat -c %U "/proc/$pid" 2>/dev/null) || user='?'
      name=$(cat "/proc/$pid/comm" 2>/dev/null) || name='?'
    else
      pids='?'
      user='?'
      name='?'
    fi
    locals=${LP_LOCAL[$key]//|/,}
    printf '%-6s %-6s %-24s %-10s %-10s %s\n' \
      "${LP_PROTO[$key]}" "${LP_PORT[$key]}" "$locals" "${pids//|/,}" "$user" "$name"
  done
  return 0
}

# 处理一个端口。返回 0 是处理干净了，1 是没处理成，3 是受保护端口被拒。
handle_port() {
  local port=$1
  local -a targets=() alive=()
  local found pid

  if is_protected "$port" && ((!FORCE)); then
    warn "端口 $port 受保护（$(protect_reason "$port")），加 --force 才可操作"
    return "$EXIT_PROTECTED"
  fi
  if is_protected "$port"; then
    warn "端口 $port 受保护（$(protect_reason "$port")），--force 已指定，继续。"
  fi

  found=$(find_pids "$port")
  case $? in
    1)
      info "端口 $port 无监听"
      return "$EXIT_FAIL"
      ;;
    2)
      warn "端口 $port 有监听但对不上进程，可能非 root 或端口在别的网络命名空间，跳过"
      return "$EXIT_FAIL"
      ;;
  esac

  while read -r pid; do
    [[ -n $pid ]] || continue
    if ((pid == 1 || pid == $$ || pid == PPID)); then
      warn "跳过 PID $pid，它是 init 或本脚本自身。"
      continue
    fi
    targets+=("$pid")
  done <<<"$found"
  ((${#targets[@]})) || {
    warn "端口 $port 的占用进程都不能动，跳过。"
    return "$EXIT_FAIL"
  }

  info "端口 $port 被占用:"
  for pid in "${targets[@]}"; do describe_pid "$pid"; done

  if ((DRY_RUN)); then
    info "干跑，未发信号。"
    return 0
  fi
  local skip_first=$SKIP_CONFIRM
  SKIP_CONFIRM=0
  if ((!skip_first)) && ! confirm "向上面这些进程发送 SIG${SIGNAL_NAME}?"; then
    if [[ ! -t 0 ]]; then
      warn "非交互环境不做确认，跳过端口 $port。"
    else
      info "已取消。"
    fi
    return "$EXIT_FAIL"
  fi

  for pid in "${targets[@]}"; do
    if kill -s "$SIGNAL" "$pid" 2>/dev/null; then
      info "已向 PID $pid 发送 SIG${SIGNAL_NAME}。"
    else
      warn "向 PID $pid 发送 SIG${SIGNAL_NAME} 失败，可能已退出或权限不足"
    fi
  done

  if ((TIMEOUT > 0)); then
    local deadline=$((SECONDS + TIMEOUT))
    while :; do
      mapfile -t alive < <(alive_pids "${targets[@]}")
      ((${#alive[@]})) || break
      ((SECONDS >= deadline)) && break
      sleep 0.2
    done
  else
    mapfile -t alive < <(alive_pids "${targets[@]}")
  fi

  if ((${#alive[@]} == 0)); then
    info "端口 $port 已释放。"
    return 0
  fi

  # SIGKILL 也送不到时没有其他办法，剩下的都是权限或内核线程问题
  if [[ $SIGNAL_NAME == KILL ]]; then
    warn "PID ${alive[*]} 仍在运行，SIGKILL 无效，多半权限不足"
    return "$EXIT_FAIL"
  fi

  info "以下进程在 ${TIMEOUT} 秒内没有退出: ${alive[*]}"
  if [[ ! -t 0 && $ASSUME_YES == 0 ]]; then
    warn "非交互环境不追问，改用 -9 或 --yes"
    return "$EXIT_FAIL"
  fi
  if ! confirm "补发 SIGKILL 强制杀掉吗?"; then
    warn "保持原样，PID ${alive[*]} 仍在运行。"
    return "$EXIT_FAIL"
  fi

  for pid in "${alive[@]}"; do
    kill -s KILL "$pid" 2>/dev/null || warn "向 PID $pid 发送 SIGKILL 失败，权限不足"
  done
  sleep 0.5
  mapfile -t alive < <(alive_pids "${targets[@]}")
  if ((${#alive[@]} == 0)); then
    info "端口 $port 已释放。"
    return 0
  fi
  warn "PID ${alive[*]} 仍在运行，SIGKILL 无效，多半权限不足"
  return "$EXIT_FAIL"
}
