# 基础设施：退出码、输出、尺寸换算、外部命令执行出口。

# 退出码：0 成功，1 有项没完成，2 用法错误，3 用户取消。
readonly EXIT_FAIL=1 EXIT_USAGE=2 EXIT_CANCEL=3

info() { printf '%s\n' "$*" >&2; }
warn() { printf 'cleanx: %s\n' "$*" >&2; }
die() {
  printf 'cleanx: %s\n' "$1" >&2
  exit "${2:-$EXIT_FAIL}"
}

usage_error() { die "$*；见 cleanx --help" "$EXIT_USAGE"; }

# 界面能否自绘：三个标准流都连着终端才算；判断必须在命令替换之外做一次，之后只读 UI_MODE。
UI_MODE=0

detect_ui_mode() {
  UI_MODE=0
  [[ -t 0 && -t 1 && -t 2 ]] || return 0
  UI_MODE=1
  return 0
}

ui_available() { ((UI_MODE)); }

# 默认只预览，--yes 才改成真删；菜单模式由交互确认兜底，启动时另行关闭。
DRY_RUN=1
ASSUME_YES=0

# 执行外部命令的唯一出口：先按可复制粘贴的形式打印，再执行；预览模式只打印。
run_cmd() {
  local -a quoted=()
  local a
  for a in "$@"; do
    quoted+=("$(printf '%q' "$a")")
  done
  printf 'cleanx: %s\n' "${quoted[*]}" >&2
  ((DRY_RUN)) && return 0
  "$@"
}

# root 项：真正执行且非交互时改用 sudo -n；预览时打印普通 sudo，方便复制出去自己跑。
run_root_cmd() {
  local -a cmd=(sudo)
  if [[ ! -t 0 ]] && ((!DRY_RUN)); then
    cmd+=(-n)
  fi
  run_cmd "${cmd[@]}" "$@"
}

# 字节数按 1024 进制显示；小于 1K 时不带小数。
format_size() {
  local b=${1:-0}
  awk -v b="$b" 'BEGIN {
    split("B K M G T P", u, " ")
    i = 1
    while (b >= 1024 && i < 6) { b /= 1024; i++ }
    if (i == 1) printf "%d%s", b, u[i]
    else printf "%.1f%s", b, u[i]
  }'
}

# 把 123.4M 这类带单位的值换算成字节，供 journalctl 的摘要输出使用。
human_to_bytes() {
  local v=$1 num unit mult
  v=${v%B}
  num=${v%[KMGTP]}
  unit=${v:${#num}}
  case "$unit" in
    '') mult=1 ;;
    K) mult=1024 ;;
    M) mult=1048576 ;;
    G) mult=1073741824 ;;
    T) mult=1099511627776 ;;
    P) mult=1125899906842624 ;;
    *) return 1 ;;
  esac
  [[ $num =~ ^[0-9]+(\.[0-9]+)?$ ]] || return 1
  awk -v n="$num" -v m="$mult" 'BEGIN { printf "%.0f", n * m }'
}
