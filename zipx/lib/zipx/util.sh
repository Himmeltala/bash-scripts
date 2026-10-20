# 基础设施：退出码、报错、外部命令检查、命令执行出口。

# 退出码：0 成功，1 操作失败，2 用法错误，3 用户取消。
readonly EXIT_FAIL=1 EXIT_USAGE=2 EXIT_CANCEL=3

# 默认排除的目录：版本库元数据、构建产物与依赖目录；--no-exclude 关掉，--exclude 追加。
readonly DEFAULT_EXCLUDES=(.git .svn .idea node_modules target)

info() { printf '%s\n' "$*" >&2; }

# 只打第一条参数：第二个参数是退出码，用 $* 会把码也打进消息里。
die() {
  printf 'zipx: %s\n' "$1" >&2
  exit "${2:-$EXIT_FAIL}"
}

# 用法错误单独一个退出码，与「动作已执行但失败」分开。
usage_error() {
  die "$*；见 zipx --help" "$EXIT_USAGE"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到 $1，先安装"
}

# 能否画界面：必须在命令替换之外只判断一次，替换里的 stdout 是管道，[[ -t 1 ]] 永远为假。
# 启动时判断一次并记进 UI_MODE，之后一律读它。
UI_MODE=0

detect_ui_mode() {
  UI_MODE=0
  command -v whiptail >/dev/null 2>&1 || return 0
  [[ -t 0 && -t 1 && -t 2 ]] || return 0
  UI_MODE=1
  return 0
}

ui_available() { ((UI_MODE)); }

# 名字带换行就没法可靠处理：清单一行一个名字，换行会被当成两个条目；撞上一律拒绝。
reject_odd_name() {
  local n=$1
  case "$n" in
    *$'\n'*) die "名字里有换行，处理不了：$(printf '%q' "$n")" ;;
  esac
  return 0
}

# 包名以减号开头时会被 zip 当成选项，前面补 ./ 再传。
archive_arg() {
  case "$1" in
    -*) printf './%s\n' "$1" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# 执行外部命令的唯一出口：先按可复制粘贴的形式印出命令，再原样执行；--dry-run 只打印，不执行。
# 命令带引号打印，路径有空格时才看得出真正传了什么。
run_cmd() {
  local -a quoted=()
  local a
  for a in "$@"; do
    quoted+=("$(printf '%q' "$a")")
  done
  printf 'zipx: %s\n' "${quoted[*]}" >&2
  ((DRY_RUN)) && return 0
  "$@"
}
