# 命令行层：帮助、参数解析与主流程，加载顺序放最后。
# 目前只有一个网页命令；终端里的查询以后再加。

readonly COMMANDS=(
  'web|起网页界面|查看变更与提交日志，拉取、推送、切换分支、更新与提交'
)
readonly DEFAULT_COMMAND='web'

usage() {
  cat <<'EOF'
用法: dvcsx [命令] [选项]

查看 SVN 工作副本或 Git 仓库的代码变更与提交日志，执行拉取、推送、切换分支、更新与提交；不带命令时起网页界面。

命令:
EOF
  local row desc
  for row in "${COMMANDS[@]}"; do
    desc=${row#*|}
    printf '  %-10s %s\n' "${row%%|*}" "${desc#*|}"
  done

  cat <<'EOF'

选项:
      --host 地址  监听地址，默认 0.0.0.0，同一网络里的机器都能开；只想本机用 --host 127.0.0.1
  -p, --port 端口  监听端口，默认 0 由系统挑一个空闲的
  -o, --open     起来后打开默认浏览器
      --allow-write  允许其他机器发起拉取、推送、切换分支、更新与提交；默认只认本机
      --json     只打一行 {"url":…,"local":…,"host":…,"port":…}，给脚本起服务用
  -h, --help     显示本帮助

退出码: 0 成功，1 执行失败，2 用法错误。
EOF
}

ACTION=''
parse_args() {
  local -a args=("$@")
  local i=0 a
  while ((i < ${#args[@]})); do
    a=${args[$i]}
    i=$((i + 1))
    case "$a" in
      -h|--help) usage; exit 0 ;;
      -p|--port) RV_PORT=${args[$i]:-}; i=$((i + 1)) ;;
      --host) RV_HOST=${args[$i]:-}; i=$((i + 1)) ;;
      -o|--open) RV_OPEN=1 ;;
      --allow-write) RV_ALLOW_WRITE=1 ;;
      --json) RV_JSON=1; WEB_JSON_FLAG=1 ;;
      -*) usage_error "未知选项 $a" ;;
      web) ACTION='web' ;;
      *) usage_error "未知命令 $a" ;;
    esac
  done
}

main() {
  parse_args "$@"
  case "${ACTION:-$DEFAULT_COMMAND}" in
    web) web_command ;;
    *) usage_error "未知命令 $ACTION" ;;
  esac
}
