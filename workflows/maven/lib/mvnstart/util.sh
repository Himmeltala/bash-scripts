# 基础设施：报错、记录分列、路径计算。
# 记录分列用的单元分隔符与缓存目录也在这里，其余各文件都依赖这两样。
readonly CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/mvnstart"
# 记录内部用 ASCII 单元分隔符分列，不能用制表符。
# 制表符算 IFS 空白，read 会把连续两个并成一个，空字段（比如不走 -pl 的目标）会丢，
# 后面的字段跟着整体错位，表现为工作目录被当成 mvn 参数。
readonly FS=$'\x1f'
die() {
  printf 'mvnstart: %s\n' "$*" >&2
  exit "${2:-1}"
}

# 用法错误按惯例退 2，与「找到了目标但执行失败」的 1 分开。
usage_error() {
  die "$*，用 mvnstart --help 看用法" 2
}

# 记录六列，按顺序是：
#   标签、工作目录、-pl 的值（不走 -pl 时为空）、mvn 参数、展示用相对路径、展示用命令
# -pl 的值单独占一列而不是先拼进参数字符串，是为了执行时能加引号，
# 路径里带空格时才不会被词拆分成两个参数。
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
