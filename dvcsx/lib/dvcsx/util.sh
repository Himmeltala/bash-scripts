# 基础设施：退出码、报错与缓存目录。

# 退出码：0 成功，1 执行失败，2 用法错误。
readonly EXIT_FAIL=1 EXIT_USAGE=2

readonly CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/dvcsx"

# 只打第一条参数：第二个参数是退出码，用 $* 会把码也打进消息里。
die() {
  printf 'dvcsx: %s\n' "$1" >&2
  exit "${2:-$EXIT_FAIL}"
}

# 用法错误按惯例退 2，与执行失败的 1 分开。
usage_error() {
  die "$*；见 dvcsx --help" "$EXIT_USAGE"
}
