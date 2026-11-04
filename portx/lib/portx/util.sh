# 基础设施：退出码、输出与本工具的全局状态。

readonly EXIT_FAIL=1 EXIT_USAGE=2 EXIT_PROTECTED=3

# 特权端口段。内核只允许 root 绑定这一段，普通用户能占用，多半说明系统里有服务在运行。
readonly PRIVILEGED_MAX=1023

# 受保护名单：系统服务与常见中间件的默认端口；8080 等开发常用端口故意不列，免得挡住 spring-boot:run。
readonly PROTECTED_PORTS=(
  21 22 23 25 53 80 111 123 137 138 139 161 162 389 443 445 465 514 587
  631 636 873 993 995 1521 2049 2181 3306 5432 5672 6379 6443 9200 11211 27017
)

readonly DEFAULT_TIMEOUT=5

declare -A PROTECTED_SET=()
for _p in "${PROTECTED_PORTS[@]}"; do PROTECTED_SET[$_p]=1; done
unset _p

KILL=0
KILL_OPT=0
LIST=0
SIGNAL='TERM'
SIGNAL_NAME='TERM'
FORCE=0
ASSUME_YES=0
SKIP_CONFIRM=0
DRY_RUN=0
UDP=0
TIMEOUT=$DEFAULT_TIMEOUT
PORTS=()

info() { printf '%s\n' "$*"; }
warn() { printf 'portx: %s\n' "$*" >&2; }
die() {
  printf 'portx: %s\n' "$*" >&2
  exit "${2:-$EXIT_FAIL}"
}

# 用法错误按惯例退 2，与「没查到或没处理成」的 1 分开。
usage_error() { die "$*；见 portx --help" "$EXIT_USAGE"; }
