# 网页模式：起 python3 转发进程，静态页面与 SVN / Git 查询、操作接口都由它出。
# 公共启动流程在 lib/shell-shared/web-command.sh，这里给参数与两项 dvcsx 专属校验/提示。

# 缺省值在这里定，parse_args 里覆盖，dvcsx -p 9999 web 与 dvcsx web -p 9999 等价。
RV_PORT=0
RV_HOST='0.0.0.0'
RV_OPEN=0
RV_JSON=0
RV_ALLOW_WRITE=0
readonly WEB_ATTACH_TIMEOUT=20

readonly WEB_HOME="$CACHE_DIR/web"
readonly WEB_STATE_FILE="$WEB_HOME/state.json"
readonly WEB_API_PREFIX='/__dvcsx/api'
readonly WEB_PAGE="$dvcsx_dir/dvcsx/web/static/index.html"

# dvcsx 不接网页状态层，web_fail 与 web_python 留在这里供共享的 web_command 用。
web_fail() {
  printf 'dvcsx: %s\n' "$1" >&2
  return "${2:-$EXIT_FAIL}"
}

# 打印可用的 python3 解释器；没有或太旧就报错。只支持标准库，3.7 起够用。
web_python() {
  local runner=${DVCSX_PYTHON:-python3} ver
  command -v "$runner" >/dev/null 2>&1 ||
    { web_fail "找不到 $runner，网页模式的转发进程靠它，先装上 python3" "$EXIT_USAGE"; return; }
  ver=$("$runner" -c 'import sys; print(sys.version_info[0] * 10 + sys.version_info[1])' 2>/dev/null) ||
    { web_fail "跑不起 $runner" "$EXIT_USAGE"; return; }
  ((ver >= 37)) || { web_fail '网页模式需要 python 3.7 或更新版本' "$EXIT_USAGE"; return; }
  printf '%s\n' "$runner"
}

# web_command 的公共流程在 lib/shell-shared/web-command.sh，这里只给参数。
WEB_TOOL='dvcsx'
WEB_ROOT="$dvcsx_dir/dvcsx/web"
WEB_SERVER_PY="$WEB_ROOT/server.py"
WEB_STATIC_DIR="$WEB_ROOT/static"
WEB_READY_MARKER='DVCSX_WEB_READY'
WEB_PYTHON_ENV='DVCSX_PYTHON'
# --json 时只打一行 JSON；dvcsx 要等转发进程退出，脚本拿到的服务才算收尾。
WEB_JSON_FLAG=0
WEB_JSON_WAIT=1
WEB_SERVER_ARGS=(--state "$WEB_STATE_FILE" --api "$WEB_API_PREFIX")
WEB_WARN_TEXT='页面没有登录，同一网络里能连上的人都能查看工作副本的变更与日志；只想本机用就加 --host 127.0.0.1'
WEB_EXIT_TEXT='按 Ctrl+C 退出网页服务。'

# 页面起不来之前先确认有可用的版本控制命令，错误比 python 侧的报错更直接。
# 放开写操作的参数也在启动前补上，与命令行解析结果保持一致。
web_command_precheck() {
  command -v svn >/dev/null 2>&1 || command -v git >/dev/null 2>&1 ||
    { web_fail '找不到 svn 与 git 命令，装上其中一个再试' "$EXIT_USAGE"; return 1; }
  ((RV_ALLOW_WRITE)) && WEB_SERVER_ARGS+=(--allow-write)
  return 0
}

# 放开写操作时再提醒一次风险；只在本机监听时不必说。
web_command_extra_warn() {
  if ((RV_ALLOW_WRITE)) &&
    [[ "$RV_HOST" != '127.0.0.1' && "$RV_HOST" != 'localhost' ]]; then
    printf '已放开写操作：同一网络里能打开页面的人都能拉取、推送、切换分支、更新与提交，确认网络可信再用 --allow-write\n' >&2
  fi
}
