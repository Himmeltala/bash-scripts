# 命令行层：帮助、参数解析与模式分发，加载顺序放最后。

usage() {
  cat <<'EOF'
用法: portx [选项] <端口>...
      portx [选项] -l
      portx

查询占用指定端口的应用与进程；加 -k 改为结束这些进程。
不带参数时打开终端菜单，-l 直接列出全部监听端口。

默认只读，显示协议、监听地址、PID、属主、命令行、可执行文件与工作目录。
默认只查 TCP 监听端口，加 -u 连 UDP 一起查。

加 -k 时先发 SIGTERM，超时后询问是否补 SIGKILL；非终端不追问，直接报告。
0 到 1023 与常见服务端口只在 -k 时拒绝，加 --force 放行。

选项:
  -k, --kill           结束占用端口的进程
  -l, --list           列出全部监听端口
  -s, --signal <信号>  发送的信号，名字或编号都行，默认 TERM（需 -k）
  -9                   等价于 -k -s KILL，直接强杀
  -f, --force          允许 -k 操作受保护端口
  -y, --yes            跳过确认，超时后是否补发 SIGKILL 也不再追问（需 -k）
  -n, --dry-run        只列出占用进程，不发信号
  -u, --udp            连 UDP 端口一起查
  -t, --timeout <秒>   发出信号后等多少秒，默认 5，0 表示不等（需 -k）
  -h, --help           显示本帮助

退出码:
  0  查到或处理成功
  1  没监听、拿不到 pid、信号没送到、进程没退出
  2  用法错误
  3  -k 撞上受保护端口，且没有 --force
EOF
}

# 校验端口并把归一化结果写进全局 NORM_PORT。
# 不用命令替换返回：子 shell 里的 exit 只退子 shell，主流程会带空端口继续执行。
NORM_PORT=''

parse_port() {
  local p=$1 n
  [[ $p =~ ^[0-9]+$ ]] || usage_error "端口 $p 不是数字"
  # 先检查位数：超长数字交给 $((10#$p)) 会直接报错退出
  ((${#p} > 5)) && usage_error "端口 $p 超出 1 到 65535"
  # 10# 前缀按十进制解析，否则 080 这类前导零会被当成八进制
  n=$((10#$p))
  ((n >= 1 && n <= 65535)) || usage_error "端口 $p 超出 1 到 65535"
  NORM_PORT=$n
}

add_port() {
  local n p
  parse_port "$1"
  n=$NORM_PORT
  for p in "${PORTS[@]}"; do
    [[ $p == "$n" ]] && return 0
  done
  PORTS+=("$n")
}

set_signal() {
  local s=${1^^} n
  if [[ $s =~ ^[0-9]+$ ]]; then
    ((s >= 1 && s <= 64)) || usage_error "信号编号 $1 超出 1 到 64"
    n=$s
  else
    s=${s#SIG}
    n=$(kill -l "$s" 2>/dev/null) || usage_error "未知信号 $1，用 kill -l 查看"
  fi
  # 编号是准的，名字只用来显示：编号写进命令，名字写进提示语
  SIGNAL_NAME=$(kill -l "$n" 2>/dev/null) || SIGNAL_NAME=$n
  SIGNAL=$n
}

set_timeout() {
  [[ $1 =~ ^[0-9]+$ ]] || usage_error "超时 $1 不是秒数"
  TIMEOUT=$((10#$1))
}

parse_args() {
  local arg
  while (($#)); do
    arg=$1
    case $arg in
      -k|--kill) KILL=1; shift ;;
      -l|--list) LIST=1; shift ;;
      -s|--signal)
        (($# >= 2)) || usage_error "$arg 后面要跟信号名或编号"
        KILL_OPT=1
        set_signal "$2"
        shift 2
        ;;
      --signal=*) KILL_OPT=1; set_signal "${arg#*=}"; shift ;;
      -9) KILL=1; set_signal KILL; shift ;;
      -t|--timeout)
        (($# >= 2)) || usage_error "$arg 后面要跟秒数"
        KILL_OPT=1
        set_timeout "$2"
        shift 2
        ;;
      --timeout=*) KILL_OPT=1; set_timeout "${arg#*=}"; shift ;;
      -f|--force) KILL_OPT=1; FORCE=1; shift ;;
      -y|--yes) KILL_OPT=1; ASSUME_YES=1; shift ;;
      -n|--dry-run) DRY_RUN=1; shift ;;
      -u|--udp) UDP=1; shift ;;
      -h|--help) usage; exit 0 ;;
      --)
        shift
        while (($#)); do
          add_port "$1"
          shift
        done
        ;;
      -*) usage_error "未知选项 $arg" ;;
      *) add_port "$arg"; shift ;;
    esac
  done

  if ((LIST)); then
    ((KILL == 0)) || usage_error '-l 不能与 -k 一起用'
    ((KILL_OPT == 0)) || usage_error '-l 不能与信号、超时、--force、--yes 一起用'
    ((${#PORTS[@]} == 0)) || usage_error '-l 不接受端口参数'
  else
    ((KILL || !KILL_OPT)) || usage_error '信号、超时、--force、--yes 只用于 -k'
  fi
}

main() {
  parse_args "$@"
  detect_ui_mode

  if ((LIST)); then
    list_all_ports
    return $?
  fi

  # 不带端口时进菜单；管道或脚本里由 bash-tui 退回编号输入。
  if ((${#PORTS[@]} == 0)); then
    ((KILL)) && usage_error '-k 后面要跟端口'
    ui_main
    return $?
  fi

  # 撞上保护端口比一般失败更严重，整体退出码以 3 优先
  local rc=0 r p
  for p in "${PORTS[@]}"; do
    if ((KILL)); then
      handle_port "$p"
    else
      query_port "$p"
    fi
    r=$?
    if ((r != 0)); then
      ((rc == 0)) && rc=$r
      ((r == EXIT_PROTECTED)) && rc=$EXIT_PROTECTED
    fi
  done
  return $rc
}
