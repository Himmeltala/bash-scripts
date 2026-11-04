# 界面层：主菜单、端口列表、操作菜单与带热键的详情页。

ui_main() {
  local choice
  while :; do
    choice=$(ui_menu_named 'portx' '选择操作' \
      query '查询端口详情' \
      list '查看端口列表' \
      quit '退出') || return 0

    case $choice in
      query) ui_query_detail ;;
      list) ui_port_list ;;
      quit) return 0 ;;
    esac
  done
}

ui_query_detail() {
  local port
  port=$(ui_input 'portx / 查询端口详情' '输入端口号' '') || return 0
  [[ $port =~ ^[0-9]+$ ]] || {
    info '端口不是数字'
    return 0
  }
  ((10#$port >= 1 && 10#$port <= 65535)) || {
    info '端口超出 1 到 65535'
    return 0
  }
  ui_detail_loop "$((10#$port))"
}

port_row_secondary() {
  local key=$1 pids=${LP_PIDS[$key]:-} pid user name locals
  locals=${LP_LOCAL[$key]//|/,}
  if [[ -n $pids ]]; then
    pid=${pids%%|*}
    user=$(stat -c %U "/proc/$pid" 2>/dev/null) || user='?'
    name=$(cat "/proc/$pid/comm" 2>/dev/null) || name='?'
    printf '%s  %s (%s)  %s\n' "$locals" "$name" "${pids//|/,}" "$user"
  else
    printf '%s  进程未知\n' "$locals"
  fi
}

ui_port_list() {
  local choice key desc udp_state
  local -a args=()

  while :; do
    scan_all_ports
    if ((UDP)); then udp_state='开'; else udp_state='关'; fi
    args=()
    for key in "${LP_SORTED[@]}"; do
      desc="$(port_row_secondary "$key")"
      if ui_available; then
        args+=("p:$key" "${LP_PORT[$key]}/${LP_PROTO[$key]}" "$desc")
      else
        # 无终端时编号菜单不显示标签，把标签并入主文本以保留旧的可见输出。
        args+=("p:$key" "p:$key  ${LP_PORT[$key]}/${LP_PROTO[$key]}" "$desc")
      fi
    done

    if ((${#args[@]} == 0)); then
      printf '没有监听端口\n' >&2
      return 0
    fi

    choice=$(ui_browse 'portx / 端口列表' "UDP：$udp_state" \
      --hotkey u udp UDP --hotkey r refresh 刷新 -- "${args[@]}") || return 0

    case "$choice" in
      '@hotkey:udp') UDP=$((1 - UDP)) ;;
      '@hotkey:refresh') ;;
      p:*) ui_port_actions "${choice#p:}" ;;
    esac
  done
}

ui_port_actions() {
  local port=${1#*:} choice
  while :; do
    choice=$(ui_menu_named "portx / $port" '选择操作' \
      detail '查看详情' \
      kill '结束进程' \
      back '返回') || return 0

    case $choice in
      detail)
        if ! ui_detail_loop "$port"; then
          return 0
        fi
        ;;
      kill)
        ui_kill_port "$port"
        return 0
        ;;
      back) return 0 ;;
    esac
  done
}

ui_kill_port() {
  local port=$1 rc
  if is_protected "$port" && ((!FORCE)); then
    info "端口 $port 受保护（$(protect_reason "$port")），请用 portx -k --force $port"
    ui_pause
    return "$EXIT_FAIL"
  fi

  ui_yesno '结束进程' "向占用端口 $port 的进程发送 SIGTERM？" || return "$EXIT_FAIL"
  SKIP_CONFIRM=1
  handle_port "$port"
  rc=$?
  SKIP_CONFIRM=0
  ((rc == 0)) || ui_pause
  return "$rc"
}

ui_enter_dir() {
  local port=$1 cwd
  cwd=$(port_cwd "$port")
  if [[ -z $cwd ]]; then
    info '拿不到该端口对应进程的工作目录'
    ui_pause
    return 0
  fi
  info "进入 $cwd，输入 exit 返回 portx"
  ( cd "$cwd" 2>/dev/null && "${SHELL:-bash}" ) || {
    warn "无法进入 $cwd"
    ui_pause
  }
}

ui_detail_lines() {
  local port=$1
  collect_port_info "$port"
  case $? in
    1) INFO_LINES=("端口 $port 无监听") ;;
    2) INFO_LINES=("端口 $port 有监听但对不上进程，可能非 root 或端口在别的网络命名空间") ;;
  esac
}

ui_detail_loop() {
  local port=$1 action
  while :; do
    action=$(ui_detail_view "$port")
    case $action in
      kill)
        ui_kill_port "$port"
        (($? == 0)) && return 1
        ;;
      dir) ui_enter_dir "$port" ;;
      udp) UDP=$((1 - UDP)) ;;
      refresh) ;;
      back | '') return 0 ;;
    esac
  done
}

ui_detail_view() {
  local port=$1 action udp_state
  if ((UDP)); then udp_state='开'; else udp_state='关'; fi
  ui_detail_lines "$port"

  if ! ui_available; then
    # 调用方会捕获 stdout，回退模式把内容写到 stderr 以保持旧的可见输出。
    ui_pager_lines "portx / 端口 $port" "UDP：$udp_state" \
      --hotkey k kill 结束 --hotkey p dir 目录 \
      --hotkey u udp UDP --hotkey r refresh 刷新 \
      -- "${INFO_LINES[@]}" >&2
    printf 'back\n'
    return 0
  fi

  action=$(ui_pager_lines "portx / 端口 $port" "UDP：$udp_state" \
    --hotkey k kill 结束 --hotkey p dir 目录 \
    --hotkey u udp UDP --hotkey r refresh 刷新 \
    -- "${INFO_LINES[@]}") || return 0

  case "$action" in
    '@hotkey:kill') printf 'kill\n' ;;
    '@hotkey:dir') printf 'dir\n' ;;
    '@hotkey:udp') printf 'udp\n' ;;
    '@hotkey:refresh') printf 'refresh\n' ;;
    *) printf 'back\n' ;;
  esac
}
