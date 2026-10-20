# 终端界面组件：主题色、尺寸、标题、提示、分隔线、行与状态栏；全部写 stderr，stdout 留给选择结果。
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
