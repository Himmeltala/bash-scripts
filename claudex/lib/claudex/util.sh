# 基础设施：退出码、输出、尺寸、命令执行出口与终端探测。

readonly EXIT_FAIL=1 EXIT_USAGE=2 EXIT_CANCEL=3

readonly CLAUDE_ROOT="${HOME}/.claude"
readonly SESSION_ROOT="${CLAUDE_ROOT}/projects"
readonly ARCHIVE_ROOT="${CLAUDEX_ARCHIVE_DIR:-${CLAUDE_ROOT}/archive}"

info() { printf '%s\n' "$*" >&2; }
warn() { printf 'claudex: %s\n' "$*" >&2; }
die() {
  printf 'claudex: %s\n' "$1" >&2
  exit "${2:-$EXIT_FAIL}"
}

usage_error() { die "$*；见 claudex --help" "$EXIT_USAGE"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到 $1，先安装"
}

# 界面自绘要求三个标准流都连着终端；判断必须在命令替换之外做一次。
UI_MODE=0

detect_ui_mode() {
  UI_MODE=0
  [[ -t 0 && -t 1 && -t 2 ]] || return 0
  UI_MODE=1
  return 0
}

ui_available() { ((UI_MODE)); }

# 归档、删除、缓存清理默认只预览；菜单里的每一步另有确认框。
DRY_RUN=1
ASSUME_YES=0

run_cmd() {
  local -a quoted=()
  local a
  for a in "$@"; do
    quoted+=("$(printf '%q' "$a")")
  done
  printf 'claudex: %s\n' "${quoted[*]}" >&2
  ((DRY_RUN)) && return 0
  "$@"
}

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

format_time() {
  local ts=${1:-0}
  date -d "@$ts" '+%Y-%m-%d %H:%M' 2>/dev/null || printf '%s' "$ts"
}
