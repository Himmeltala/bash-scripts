# 基础设施：退出码、报错、终端探测、记录分列、路径计算，以及单元分隔符与缓存目录。

# 退出码：0 成功，1 找到了目标但执行失败，2 用法错误，3 用户取消；4 只在步骤间传返回上一步，不作进程退出码。
readonly EXIT_FAIL=1 EXIT_USAGE=2 EXIT_CANCEL=3 EXIT_BACK=4

readonly CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/gradlex"
# 记录用 ASCII 单元分隔符分列，不能用制表符：制表符算 IFS 空白，连续两个会被并成一个，空字段丢失并导致字段错位。
readonly FS=$'\x1f'
# 只打第一条参数：第二个参数是退出码，用 $* 会把码也打进消息里。
die() {
  printf 'gradlex: %s\n' "$1" >&2
  exit "${2:-$EXIT_FAIL}"
}

# 用法错误按惯例退 2，与「找到了目标但执行失败」的 1、用户取消的 3 分开。
usage_error() {
  die "$*；见 gradlex --help" "$EXIT_USAGE"
}

# 能否画界面：界面自绘，要求三个标准流都连着终端；必须在命令替换之外只判断一次，替换里的 stdout 是管道，[[ -t 1 ]] 永远为假，会静默退化成编号输入。
UI_MODE=0

detect_ui_mode() {
  UI_MODE=0
  [[ -t 0 && -t 1 && -t 2 ]] || return 0
  UI_MODE=1
  return 0
}

ui_available() { ((UI_MODE)); }

# 记录六列：标签、工作目录、Gradle 项目路径（如 :module）、任务参数、展示用相对路径、展示用命令。
# 项目路径单列存放，执行时才能加引号，路径带空格时不被词拆分成两个参数。
emit_record() {
  local i out=''
  for ((i = 1; i <= $#; i++)); do
    ((i > 1)) && out+="$FS"
    out+="${!i}"
  done
  printf '%s\n' "$out"
}

# 取父目录。用参数展开算，不派生 dirname 子进程。
parent_dir() {
  local p="${1%/}"
  [[ "$p" == */* ]] || { printf '/\n'; return 0; }
  p="${p%/*}"
  printf '%s\n' "${p:-/}"
}

# 路径规整：展开 . 与 ..，就地算，不派生 realpath 子进程。
normalize_path() {
  local -a parts=() out=()
  local part
  IFS='/' read -r -a parts <<< "$1"
  for part in "${parts[@]}"; do
    case "$part" in
      ''|.) ;;
      ..) ((${#out[@]})) && unset 'out[-1]' ;;
      *) out+=("$part") ;;
    esac
  done
  local IFS='/'
  printf '/%s\n' "${out[*]}"
}

# 从当前目录算到目标目录的相对路径，同样不派生 realpath。
relative_to_pwd() {
  local target=$1
  [[ "$target" == "$PWD" ]] && { printf '.\n'; return 0; }

  local -a tb=() bb=()
  IFS='/' read -r -a tb <<< "$target"
  IFS='/' read -r -a bb <<< "$PWD"
  local tn=${#tb[@]} bn=${#bb[@]}

  local i=0
  while ((i < tn && i < bn)) && [[ "${tb[$i]}" == "${bb[$i]}" ]]; do
    i=$((i + 1))
  done

  local -a out=()
  local j
  for ((j = i; j < bn; j++)); do out+=(..); done
  for ((j = i; j < tn; j++)); do out+=("${tb[$j]}"); done
  ((${#out[@]})) || { printf '.\n'; return 0; }

  local IFS='/'
  printf '%s\n' "${out[*]}"
}
