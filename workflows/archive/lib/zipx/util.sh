# 基础设施：退出码、报错、外部命令检查、命令执行出口。

# 退出码：0 成功，1 操作失败，2 用法错误，3 用户取消。
readonly EXIT_FAIL=1 EXIT_USAGE=2 EXIT_CANCEL=3

# 默认排除的目录名。版本库元数据、构建产物、依赖目录，塞进包里只会让包变大，
# 解压出来也没用。命令行加 --no-exclude 关掉，或用 --exclude 再加别的。
readonly DEFAULT_EXCLUDES=(.git .svn .idea node_modules target)

info() { printf '%s\n' "$*" >&2; }

die() {
  printf 'zipx: %s\n' "$*" >&2
  exit "${2:-$EXIT_FAIL}"
}

# 用法错误单独一个退出码，与「动作跑了但失败」分开。
usage_error() {
  die "$*，用 zipx --help 看用法" "$EXIT_USAGE"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到 $1，先装上再用"
}

# 能不能画界面。这个判断必须在任何命令替换之外做，而且只做一次。
# 原因：界面函数都是 out=$(ui_menu ...) 这样调用的，命令替换会把 stdout 换成管道，
# 在替换里判断 [[ -t 1 ]] 永远是假，界面会永远退化成编号输入，还不报错。
# 所以启动时判一次，结果记进 UI_MODE，之后一律读这个变量。
UI_MODE=0

detect_ui_mode() {
  UI_MODE=0
  command -v whiptail >/dev/null 2>&1 || return 0
  [[ -t 0 && -t 1 && -t 2 ]] || return 0
  UI_MODE=1
  return 0
}

ui_available() { ((UI_MODE)); }

# 名字里带换行就没法可靠处理：勾选界面与包内清单都是一行一个名字，
# 换行会被当成两个条目。撞上一律拒绝，不做猜测。
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

# 执行外部命令的唯一出口：先把命令按可复制粘贴的形式印出来，
# 再原样跑。--dry-run 时只印不跑。
# 命令本身带引号打印，路径里有空格时才看得出来真正传了什么。
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
