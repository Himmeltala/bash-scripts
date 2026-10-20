# 终端界面组件：主题色、标题、提示、分隔线、行、状态栏、选择、输入、确认与文本查看；全部写 stderr，stdout 留给选择结果。
# 颜色遵循 NO_COLOR 约定，TERM=dumb 时整体退化为无颜色。

TUI_LINES=24
TUI_COLS=100
TUI_C_RESET=''
TUI_C_ACCENT=''
TUI_C_DIM=''
TUI_C_OK=''
TUI_C_WARN=''
TUI_C_BOLD=''

# 主题只初始化一次，之后各组件直接读这几个变量。
tui_theme() {
  TUI_C_RESET=''
  TUI_C_ACCENT=''
  TUI_C_DIM=''
  TUI_C_OK=''
  TUI_C_WARN=''
  TUI_C_BOLD=''
  [[ -n ${NO_COLOR:-} || ${TERM:-} == dumb ]] && return 0

  TUI_C_RESET=$'\033[0m'
  TUI_C_ACCENT=$'\033[1;38;5;45m'
  TUI_C_DIM=$'\033[38;5;244m'
  TUI_C_OK=$'\033[38;5;42m'
  TUI_C_WARN=$'\033[38;5;214m'
  TUI_C_BOLD=$'\033[1m'
  return 0
}

# 每帧都取一次尺寸，终端缩放后下一帧自动跟上。
tui_size() {
  TUI_LINES=$(tput lines 2>/dev/null || printf '24')
  TUI_COLS=$(tput cols 2>/dev/null || printf '100')
  ((TUI_COLS < 40)) && TUI_COLS=40
  return 0
}

tui_begin() {
  tui_theme
  printf '\033[?1049h\033[?25l' >&2
}

tui_end() {
  printf '\033[?1049l\033[?25h' >&2
}

tui_clear() {
  printf '\033[H\033[2J' >&2
}

# 标题行。前面留一行空白，标题左侧一条强调色竖条。
tui_title() {
  printf '\n %s▌%s %s%s%s\n' "$TUI_C_ACCENT" "$TUI_C_RESET" "$TUI_C_BOLD" "$1" "$TUI_C_RESET" >&2
}

tui_subtitle() {
  [[ -n "$1" ]] || return 0
  printf '   %s%s%s\n' "$TUI_C_DIM" "$1" "$TUI_C_RESET" >&2
}

# 键位提示。参数为「按键、说明」成对给出。
tui_hint() {
  local first=1
  printf ' ' >&2
  while (($# >= 2)); do
    ((first)) || printf '   ' >&2
    printf '%s%s%s %s%s%s' \
      "$TUI_C_ACCENT" "$1" "$TUI_C_RESET" "$TUI_C_DIM" "$2" "$TUI_C_RESET" >&2
    first=0
    shift 2
  done
  printf '\n' >&2
}

# 按终端显示宽度计算长度与截断，非 ASCII 按两列计；结果写 TUI_W 与 TUI_TEXT，不走命令替换，避免每帧每行都 fork。
TUI_W=0
TUI_TEXT=''

tui_width() {
  local s=$1 i c
  TUI_W=0
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    if [[ "$c" == [[:ascii:]] ]]; then
      TUI_W=$((TUI_W + 1))
    else
      TUI_W=$((TUI_W + 2))
    fi
  done
}

tui_clip() {
  local s=$1 max=$2 i c inc w=0
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    if [[ "$c" == [[:ascii:]] ]]; then
      inc=1
    else
      inc=2
    fi
    ((w + inc > max)) && break
    w=$((w + inc))
  done
  TUI_TEXT=${s:0:i}
}

tui_rule() {
  local i n=${1:-$((TUI_COLS - 2))}
  printf ' %s' "$TUI_C_DIM" >&2
  for ((i = 0; i < n; i++)); do
    printf '─' >&2
  done
  printf '%s\n' "$TUI_C_RESET" >&2
}

# 一行清单项。$1 是否光标行，$2 勾选标记（菜单传空），$3 主文本，$4 次要文本。
tui_row() {
  local cursor=$1 mark=$2 primary=$3 secondary=$4
  local fixed=5 room used
  [[ -n "$mark" ]] && fixed=9
  room=$((TUI_COLS - fixed - 2))
  tui_clip "$primary" "$room"
  primary=$TUI_TEXT

  if ((cursor)); then
    printf ' %s▌%s ' "$TUI_C_ACCENT" "$TUI_C_RESET" >&2
  else
    printf '   ' >&2
  fi

  if [[ -n "$mark" ]]; then
    if [[ "$mark" == '[x]' ]]; then
      printf '%s%s%s ' "$TUI_C_OK" "$mark" "$TUI_C_RESET" >&2
    else
      printf '%s%s%s ' "$TUI_C_DIM" "$mark" "$TUI_C_RESET" >&2
    fi
  fi

  if ((cursor)); then
    printf '%s%s%s' "$TUI_C_BOLD" "$primary" "$TUI_C_RESET" >&2
  else
    printf '%s' "$primary" >&2
  fi

  if [[ -n "$secondary" ]]; then
    tui_width "$primary"
    used=$TUI_W
    room=$((TUI_COLS - fixed - used - 2))
    if ((room > 0)); then
      tui_clip "$secondary" "$room"
      secondary=$TUI_TEXT
      printf '  %s%s%s' "$TUI_C_DIM" "$secondary" "$TUI_C_RESET" >&2
    fi
  fi
  printf '\n' >&2
}

# 底部状态栏：左侧统计，右侧操作提示，中间自动留白。
tui_status() {
  local left=$1 right=$2 pad lw rw
  printf ' %s%s%s' "$TUI_C_DIM" "$left" "$TUI_C_RESET" >&2
  if [[ -n "$right" ]]; then
    tui_width "$left"
    lw=$TUI_W
    tui_width "$right"
    rw=$TUI_W
    pad=$((TUI_COLS - 1 - lw - rw))
    ((pad < 1)) && pad=1
    printf '%*s' "$pad" '' >&2
    printf '%s%s%s' "$TUI_C_DIM" "$right" "$TUI_C_RESET" >&2
  fi
  printf '\n' >&2
}

# 选择界面：$1 模式（menu 单选、checklist 复选、all 带「全部」），$2 标题，$3 提示，其余为标签与显示文本，成对给出。
# 选中的标签每行输出一个；取消返回 1，复选没勾返回 2，按左箭头或 b 返回上一步时为 4。
tui_select() {
  local mode=$1 title=$2 prompt=$3
  shift 3
  local -a tags=() displays=() on=() picked=()
  local i n=$(($# / 2))
  while (($#)); do
    tags+=("$1")
    displays+=("$2")
    shift 2
  done

  local is_all=0 base=0
  if [[ "$mode" == all ]]; then
    is_all=1
    base=1
  fi
  local rows=$((n + is_all))
  local cursor=0 offset=0 cursor_max=$((rows - 1))
  local all_on=0

  if [[ "$mode" != menu ]]; then
    # 上次勾过的预选中，读进数组比对，别用 grep 逐条开进程。
    local -A saved=()
    local line
    if [[ -n ${SEL_FILE:-} && -f $SEL_FILE ]]; then
      while IFS= read -r line; do
        [[ -n "$line" ]] && saved[$line]=1
      done < "$SEL_FILE"
    elif [[ -n ${TUI_PRESELECT:-} ]]; then
      while IFS= read -r line; do
        [[ -n "$line" ]] && saved[$line]=1
      done <<< "$TUI_PRESELECT"
    fi
    for ((i = 0; i < n; i++)); do
      on[i]=0
      [[ -n "${saved[${tags[$i]}]:-}" ]] && on[i]=1
    done

    all_on=1
    for ((i = 0; i < n; i++)); do
      if ((on[i] == 0)); then
        all_on=0
        break
      fi
    done
  fi

  local listh row idx mark key key2 key3
  local selected=0 footer=''

  trap 'tui_end; exit 130' INT TERM
  trap 'tui_end' EXIT
  tui_begin

  local rc=0
  while :; do
    tui_size
    listh=$((TUI_LINES - 8))
    ((listh > rows)) && listh=$rows
    ((listh < 1)) && listh=1
    ((cursor < offset)) && offset=$cursor
    ((cursor >= offset + listh)) && offset=$((cursor - listh + 1))

    tui_clear
    tui_title "$title"
    tui_subtitle "$prompt"
    if [[ "$mode" == menu ]]; then
      tui_hint '↑↓' '移动' '回车' '选择' 'q' '取消'
    else
      tui_hint '↑↓' '移动' '空格' '勾选' '回车' '确认' '←' '返回' 'q' '取消'
    fi
    tui_rule

    for ((row = offset; row < offset + listh && row < rows; row++)); do
      if [[ "$mode" == menu ]]; then
        idx=$((row - base))
        tui_row "$((row == cursor))" '' "${tags[$idx]}" "${displays[$idx]}"
        continue
      fi

      if ((is_all && row == 0)); then
        ((all_on)) && mark='[x]' || mark='[ ]'
        tui_row "$((row == cursor))" "$mark" '全部' '选中全部模块'
      else
        idx=$((row - base))
        ((on[idx])) && mark='[x]' || mark='[ ]'
        tui_row "$((row == cursor))" "$mark" "${tags[$idx]}" "${displays[$idx]}"
      fi
    done

    tui_rule
    selected=0
    for ((i = 0; i < n; i++)); do
      ((on[i])) && selected=$((selected + 1))
    done
    if [[ "$mode" == menu ]]; then
      footer=$((cursor + 1))"/$n"
    else
      footer="已选 $selected/$n"
      ((offset > 0)) && footer+='   ↑ 更多'
      ((offset + listh < rows)) && footer+='   ↓ 更多'
    fi
    tui_status "$footer" 'q 取消'

    IFS= read -rsn1 key || { rc=1; break; }
    case "$key" in
      '')
        if [[ "$mode" == menu ]]; then
          printf '%s\n' "${tags[$cursor]}"
          rc=0
          break
        fi
        break
        ;;
      ' '|x|X)
        [[ "$mode" == menu ]] && continue
        if ((is_all && cursor == 0)); then
          if ((all_on)); then
            for ((i = 0; i < n; i++)); do on[i]=0; done
            all_on=0
          else
            for ((i = 0; i < n; i++)); do on[i]=1; done
            all_on=1
          fi
        else
          idx=$((cursor - base))
          on[idx]=$((1 - on[idx]))
          all_on=1
          for ((i = 0; i < n; i++)); do
            if ((on[i] == 0)); then
              all_on=0
              break
            fi
          done
        fi
        ;;
      k|K)
        ((cursor > 0)) && cursor=$((cursor - 1))
        ;;
      j|J)
        ((cursor < cursor_max)) && cursor=$((cursor + 1))
        ;;
      q|Q)
        rc=1
        break
        ;;
      b|B|$'\177'|$'\b')
        rc=4
        break
        ;;
      $'\033')
        IFS= read -rsn1 -t 0.05 key2 || key2=''
        if [[ "$key2" == '[' ]]; then
          IFS= read -rsn1 -t 0.05 key3 || key3=''
          case "$key3" in
            A) ((cursor > 0)) && cursor=$((cursor - 1)) ;;
            B) ((cursor < cursor_max)) && cursor=$((cursor + 1)) ;;
            D) rc=4; break ;;
          esac
        else
          rc=4
          break
        fi
        ;;
    esac
  done

  trap - EXIT INT TERM
  tui_end

  ((rc == 0)) || return "$rc"
  [[ "$mode" == menu ]] && return 0

  picked=()
  for ((i = 0; i < n; i++)); do
    ((on[i])) && picked+=("${tags[$i]}")
  done
  ((${#picked[@]})) || return 2
  printf '%s\n' "${picked[@]}"
  return 0
}


# 单行输入。$1 标题，$2 提示，$3 默认值；输出输入内容，取消返回 1。
tui_input() {
  local title=$1 prompt=$2 default=${3:-} answer='' rc=0
  trap 'tui_end; exit 130' INT TERM
  trap 'tui_end' EXIT
  tui_begin
  tui_size
  tui_clear
  tui_title "$title"
  tui_subtitle "$prompt"
  tui_hint '回车' '确认' 'Ctrl+C' '取消'
  tui_rule
  printf ' > ' >&2
  IFS= read -re -i "$default" answer || rc=1
  trap - EXIT INT TERM
  tui_end
  ((rc == 0)) || return 1
  printf '%s\n' "$answer"
  return 0
}

# 是或否确认。$1 标题，$2 提示；按 y 返回 0，其余返回 1。
tui_confirm() {
  local title=$1 prompt=$2 key=''
  trap 'tui_end; exit 130' INT TERM
  trap 'tui_end' EXIT
  tui_begin
  tui_size
  tui_clear
  tui_title "$title"
  tui_subtitle "$prompt"
  tui_hint 'y' '确认' 'n' '取消'
  tui_rule
  IFS= read -rsn1 key || key=''
  trap - EXIT INT TERM
  tui_end
  [[ "$key" == y || "$key" == Y ]]
}

# 分页查看文件内容。$1 标题，$2 文件；q、回车或 Esc 关闭。
tui_textbox() {
  local title=$1 file=$2
  local -a lines=()
  mapfile -t lines < "$file"
  local n=${#lines[@]} cursor=0 offset=0 listh row key key2 key3
  local floor

  trap 'tui_end; exit 130' INT TERM
  trap 'tui_end' EXIT
  tui_begin

  while :; do
    tui_size
    listh=$((TUI_LINES - 8))
    ((listh > n)) && listh=$n
    ((listh < 1)) && listh=1
    ((cursor < offset)) && offset=$cursor
    ((cursor >= offset + listh)) && offset=$((cursor - listh + 1))
    floor=$((n - listh))
    ((offset > floor)) && offset=$((floor > 0 ? floor : 0))

    tui_clear
    tui_title "$title"
    tui_hint '↑↓' '滚动' 'q' '关闭'
    tui_rule
    for ((row = offset; row < offset + listh && row < n; row++)); do
      tui_clip "${lines[$row]}" "$((TUI_COLS - 2))"
      printf ' %s\n' "$TUI_TEXT" >&2
    done
    tui_rule
    tui_status "$((offset + 1))-$((offset + listh))/$n" 'q 关闭'

    IFS= read -rsn1 key || { key='q'; }
    case "$key" in
      ''|q|Q) break ;;
      j|J) ((cursor < n - 1)) && cursor=$((cursor + 1)) ;;
      k|K) ((cursor > 0)) && cursor=$((cursor - 1)) ;;
      ' ') ((cursor + listh < n)) && cursor=$((cursor + listh)) ;;
      $'\033')
        IFS= read -rsn1 -t 0.05 key2 || key2=''
        if [[ "$key2" == '[' ]]; then
          IFS= read -rsn1 -t 0.05 key3 || key3=''
          case "$key3" in
            A) ((cursor > 0)) && cursor=$((cursor - 1)) ;;
            B) ((cursor < n - 1)) && cursor=$((cursor + 1)) ;;
          esac
        else
          break
        fi
        ;;
    esac
  done

  trap - EXIT INT TERM
  tui_end
  return 0
}
