# 界面层：主菜单、端口列表、操作菜单与带热键的详情页。

ui_main() {
  local choice
  while :; do
    choice=$(ui_menu 'portx' '选择操作' \
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

port_row_desc() {
  local key=$1
  printf '%s/%s  %s\n' "${LP_PORT[$key]}" "${LP_PROTO[$key]}" "$(port_row_secondary "$key")"
}

ui_port_list() {
  local choice
  while :; do
    if ui_available; then
      choice=$(ui_port_list_view) || return 0
    else
      choice=$(ui_port_list_fallback) || return 0
    fi

    case $choice in
      udp) UDP=$((1 - UDP)) ;;
      back | '') return 0 ;;
      p:*) ui_port_actions "${choice#p:}" ;;
    esac
  done
}

ui_port_list_fallback() {
  local key
  local -a args=()
  scan_all_ports
  if ((${#LP_SORTED[@]} == 0)); then
    printf '没有监听端口\n' >&2
    return 1
  fi
  for key in "${LP_SORTED[@]}"; do
    args+=("p:$key" "$(port_row_desc "$key")")
  done
  ui_menu 'portx / 端口列表' '选择端口' "${args[@]}"
}

ui_port_list_view() {
  local -a keys=() primaries=() secondaries=()
  local cursor=0 offset=0 n=0 listh=0 row=0 need_load=1 action='' udp_state key

  tui_begin
  while :; do
    if ((need_load)); then
      scan_all_ports
      keys=("${LP_SORTED[@]}")
      primaries=()
      secondaries=()
      for key in "${keys[@]}"; do
        primaries+=("${LP_PORT[$key]}/${LP_PROTO[$key]}")
        secondaries+=("$(port_row_secondary "$key")")
      done
      n=${#keys[@]}
      need_load=0
    fi

    tui_size
    listh=$((_TUI_LINES - _TUI_CHROME_LINES))
    ((listh > n)) && listh=$n
    ((listh < 1)) && listh=1
    if ((n > 0)); then
      _tui_clamp_window "$cursor" "$offset" "$listh" "$n"
      cursor=$_TUI_CURSOR
      offset=$_TUI_OFFSET
    else
      cursor=0
      offset=0
    fi

    if ((UDP)); then udp_state='开'; else udp_state='关'; fi

    tui_frame_begin
    tui_clear
    tui_title 'portx / 端口列表'
    tui_subtitle "UDP：$udp_state"
    tui_hint '↑↓' '选择' '回车' '操作' 'u' 'UDP' 'r' '刷新' 'q' '返回'
    tui_rule
    if ((n == 0)); then
      printf '   没有监听端口%s\n' "$_TUI_CLEAR_LINE" >&2
    else
      for ((row = offset; row < offset + listh && row < n; row++)); do
        tui_row "$((row == cursor))" '' "${primaries[$row]}" "${secondaries[$row]}"
      done
    fi
    tui_rule
    if ((n == 0)); then
      tui_status '0/0' 'q 返回'
    else
      tui_status "$((offset + 1))-$((offset + listh))/$n" 'q 返回'
    fi
    tui_frame_end

    if ! _tui_read_key; then
      action='back'
      break
    fi
    case "$_TUI_KEY" in
      ENTER)
        if ((n > 0)); then
          action="p:${keys[$cursor]}"
          break
        fi
        ;;
      u | U)
        action='udp'
        break
        ;;
      r | R) need_load=1 ;;
      q | Q | ESC | LEFT)
        action='back'
        break
        ;;
      UP) ((cursor > 0)) && cursor=$((cursor - 1)) ;;
      DOWN) ((cursor < n - 1)) && cursor=$((cursor + 1)) ;;
      '[') ((cursor >= listh)) && cursor=$((cursor - listh)) || cursor=0 ;;
      ']')
        cursor=$((cursor + listh))
        ((cursor >= n)) && cursor=$((n - 1))
        ;;
    esac
  done
  tui_end
  printf '%s\n' "$action"
}

ui_port_actions() {
  local port=${1#*:} choice
  while :; do
    choice=$(ui_menu "portx / $port" '选择操作' \
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

ui_pause() {
  [[ -t 0 ]] || return 0
  printf '按回车返回' >&2
  read -r _ || true
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
      back | '') return 0 ;;
    esac
  done
}

ui_detail_view() {
  local port=$1
  local -a lines=()
  local cursor=0 offset=0 n=0 listh=0 row=0 need_load=1 action='' udp_state

  if ! ui_available; then
    ui_detail_lines "$port"
    printf '%s\n' "${INFO_LINES[@]}" >&2
    printf 'back\n'
    return 0
  fi

  tui_begin
  while :; do
    if ((need_load)); then
      ui_detail_lines "$port"
      lines=("${INFO_LINES[@]}")
      n=${#lines[@]}
      ((n < 1)) && n=1
      need_load=0
    fi

    tui_size
    listh=$((_TUI_LINES - _TUI_CHROME_LINES))
    ((listh > n)) && listh=$n
    ((listh < 1)) && listh=1
    _tui_clamp_window "$cursor" "$offset" "$listh" "$n"
    cursor=$_TUI_CURSOR
    offset=$_TUI_OFFSET

    if ((UDP)); then udp_state='开'; else udp_state='关'; fi

    tui_frame_begin
    tui_clear
    tui_title "portx / 端口 $port"
    tui_subtitle "UDP：$udp_state"
    tui_hint '↑↓' '滚动' 'k' '结束' 'p' '目录' 'u' 'UDP' 'r' '刷新' 'q' '返回'
    tui_rule
    for ((row = offset; row < offset + listh && row < n; row++)); do
      _tui_clip_to "${lines[$row]}" "$((_TUI_COLS - 2))"
      printf ' %s%s\n' "$_TUI_TEXT" "$_TUI_CLEAR_LINE" >&2
    done
    tui_rule
    tui_status "$((offset + 1))-$((offset + listh))/$n" 'q 返回'
    tui_frame_end

    if ! _tui_read_key; then
      action='back'
      break
    fi
    case "$_TUI_KEY" in
      k | K)
        action='kill'
        break
        ;;
      p | P)
        action='dir'
        break
        ;;
      u | U)
        action='udp'
        break
        ;;
      r | R) need_load=1 ;;
      q | Q | ESC | LEFT)
        action='back'
        break
        ;;
      UP) ((cursor > 0)) && cursor=$((cursor - 1)) ;;
      DOWN) ((cursor < n - 1)) && cursor=$((cursor + 1)) ;;
      '[') ((cursor >= listh)) && cursor=$((cursor - listh)) || cursor=0 ;;
      ']')
        cursor=$((cursor + listh))
        ((cursor >= n)) && cursor=$((n - 1))
        ;;
    esac
  done
  tui_end
  printf '%s\n' "$action"
}
