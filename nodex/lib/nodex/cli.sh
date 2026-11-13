# 命令行层：命令注册表、帮助生成、参数解析、动作分发与主菜单，加载顺序放最后。
# 注册表每行四列以竖线分隔且内容不能含竖线：命令名|说明|收集函数|名词。

readonly COMMANDS=(
  'dev|启动开发服务|collect_dev|可启动的脚本'
  'build|构建脚本|collect_build|可构建的脚本'
  'install|安装依赖|collect_install|脚本'
)
readonly DEFAULT_COMMAND='dev'

command_exists() {
  local row
  for row in "${COMMANDS[@]}"; do
    [[ "${row%%|*}" == "$1" ]] && return 0
  done
  return 1
}

# 取注册表某行的第 idx 列，1 是命令名。纯 bash 拆，不调 cut。
command_field() {
  local name=$1 idx=$2 row rest i
  for row in "${COMMANDS[@]}"; do
    [[ "${row%%|*}" == "$name" ]] || continue
    rest="${row#*|}"
    for ((i = 2; i < idx; i++)); do
      rest="${rest#*|}"
    done
    printf '%s\n' "${rest%%|*}"
    return 0
  done
  return 1
}

usage() {
  cat <<'EOF'
用法: nodex [命令] [选项] [关键词]

在当前目录找 Node 工作区里的脚本，勾选后执行；不带参数时先选命令。
包管理器按 packageManager 字段、依赖安装痕迹与锁文件判定，认 pnpm、yarn、npm。

命令:
EOF
  local row
  for row in "${COMMANDS[@]}"; do
    printf '  %-10s %s\n' "${row%%|*}" "$(command_field "${row%%|*}" 2)"
  done

  cat <<'EOF'

网页命令:
  nodex web       起网页界面，左侧添加工作区，右侧点按钮启动、打包、装依赖、压缩
      --host 地址  监听地址，默认 0.0.0.0，同一网络里的机器都能开；只想本机用 --host 127.0.0.1
  -p, --port 端口  监听端口，默认 0 由系统挑一个空闲的
  -o, --open     起来后打开默认浏览器
      --json     只打一行 {"url":…,"local":…,"host":…,"port":…}，给脚本起服务用

选项:
  -l, --list     只列出目标，不执行；没写命令时按 dev 列
      --refresh  清掉当前命令上次的勾选记录，重新开始
  -h, --help     显示本帮助
      --         终止选项解析，后面的词一律当关键词

带关键词时跳过勾选，按子串匹配标签、路径或脚本目录后执行。

启动脚本优先取 dev，其次 start，最后 serve；都没有时收 dev:、start:、serve: 开头的变体，
各有几个就列几个。构建先认 build，没有就收 build: 开头的变体。
安装默认 npm install：工作区根装全部，子目录用 --workspace 只装自己；网页里可以整条改。

退出码: 0 成功，1 找到了目标但执行失败，2 用法错误，3 用户取消。
EOF
}

# 解析结果放全局。不用命令替换接：命令替换会开子 shell，函数里的赋值出不来。
ACTION=''
WEB_ENGINE=0
JSON_ONLY=0
LIST_ONLY=0
REFRESH=0
declare -a POSITIONAL=()
declare -a UI_ACTION_ITEMS=()

is_action() { command_exists "$1"; }

parse_args() {
  local -a args=("$@")
  local end_opts=0 i=0 a
  while ((i < ${#args[@]})); do
    a=${args[$i]}
    i=$((i + 1))

    if ((end_opts)); then
      POSITIONAL+=("$a")
      continue
    fi

    case "$a" in
      --) end_opts=1 ;;
      -h|--help) usage; exit 0 ;;
      -l|--list) LIST_ONLY=1 ;;
      --refresh) REFRESH=1 ;;
      -p|--port) RV_PORT=${args[$i]:-}; i=$((i + 1)) ;;
      --host) RV_HOST=${args[$i]:-}; i=$((i + 1)) ;;
      -o|--open) RV_OPEN=1 ;;
      --json) JSON_ONLY=1 ;;
      --engine) WEB_ENGINE=1 ;;
      web) if [[ -z "$ACTION" ]]; then ACTION='web'; else POSITIONAL+=("$a"); fi ;;
      -*) usage_error "未知选项 $a" ;;
      *)
        if [[ -z "$ACTION" ]] && is_action "$a"; then
          ACTION=$a
        else
          POSITIONAL+=("$a")
        fi
        ;;
    esac
  done
}

build_action_items() {
  UI_ACTION_ITEMS=()
  local row name
  for row in "${COMMANDS[@]}"; do
    name="${row%%|*}"
    UI_ACTION_ITEMS+=("$name" "$(command_field "$name" 2)")
  done
  UI_ACTION_ITEMS+=('quit' '退出')
}

# 执行一个动作。$1 是命令名，$2 起是位置参数，只取第一个当关键词。
run_action() {
  local cmd=$1
  shift
  local kw=${1:-}

  local noun collector root
  noun=$(command_field "$cmd" 4)
  collector=$(command_field "$cmd" 3)

  mkdir -p "$CACHE_DIR"
  local key
  key=$(printf '%s' "$PWD" | md5sum | cut -c1-16)
  SEL_FILE="$CACHE_DIR/$key.$cmd.selected"
  ((REFRESH)) && rm -f "$SEL_FILE"

  root=$(find_package_root "$PWD") ||
    die "当前目录及其上级都没有 package.json，不是 Node 项目"
  prepare_scripts "$root"

  local -a recs=()
  mapfile -t recs < <("$collector" | assign_tags)
  [[ ${#recs[@]} -gt 0 ]] || die "当前目录下没有找到$noun"

  local rec tag workdir rel args display cmdtext
  if ((LIST_ONLY)); then
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir rel args display cmdtext <<< "$rec"
      printf '%-40s %s\n' "$tag" "$cmdtext"
    done
    return 0
  fi

  local -a chosen=()
  local out
  if [[ -n "$kw" ]]; then
    local lower="${kw,,}"
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir rel args display cmdtext <<< "$rec"
      if [[ "${tag,,}" == *"$lower"* ]] ||
         [[ "${display,,}" == *"$lower"* ]] ||
         [[ "${workdir,,}" == *"$lower"* ]]; then
        chosen+=("$rec")
      fi
    done
    [[ ${#chosen[@]} -gt 0 ]] || die "没有$noun匹配关键词 $kw"
  else
    local rc=0
    out=$(nodex_ui_checklist "$noun" "${recs[@]}") || rc=$?
    case "$rc" in
      0) : ;;
      4) return "$EXIT_BACK" ;;
      1) die '已取消' "$EXIT_CANCEL" ;;
      *) die "一个$noun都没勾" "$EXIT_CANCEL" ;;
    esac
    mapfile -t chosen <<< "$out"
  fi

  save_selection "${chosen[@]}"

  # 装依赖串行跑：同一个工作区里两条 install 同时跑会抢锁。
  if [[ "$cmd" == 'install' ]]; then
    run_serial "${chosen[@]}" || die '安装失败'
    return 0
  fi

  # 单条记录会 exec 成包管理器，正常情况下回不来；能回来只可能是工作目录进不去。
  launch_records "${chosen[@]}" || die '执行失败，工作目录可能不存在'
}

# 不带参数时的主菜单：先选动作再勾目标，执行完或返回上一步都回到这里，选退出才离开。
ui_main() {
  local action rc=0
  while :; do
    action=$(ui_menu_named 'nodex' '选命令' "${UI_ACTION_ITEMS[@]}") || return "$EXIT_CANCEL"
    [[ "$action" == 'quit' ]] && break
    rc=0
    run_action "$action" || rc=$?
    ((rc == 0 || rc == EXIT_BACK)) && continue
    return "$rc"
  done
  return 0
}

main() {
  parse_args "$@"

  if ((WEB_ENGINE)); then
    web_engine
    return
  fi
  if [[ "$ACTION" == 'web' ]]; then
    web_command
    return
  fi

  command -v node >/dev/null || die '找不到 node，确认 Node.js 在 PATH 中'
  # 终端探测只做一次且必须在命令替换之前，替换里的 stdout 是管道，那时 [[ -t 1 ]] 永远为假。
  ui_detect
  build_action_items

  local rc=0
  if [[ -n "$ACTION" ]]; then
    run_action "$ACTION" "${POSITIONAL[@]}" || rc=$?
    ((rc == EXIT_BACK)) && rc=$EXIT_CANCEL
    return "$rc"
  fi

  if ((${#POSITIONAL[@]})) || ((LIST_ONLY)); then
    run_action "$DEFAULT_COMMAND" "${POSITIONAL[@]}" || rc=$?
    ((rc == EXIT_BACK)) && rc=$EXIT_CANCEL
    return "$rc"
  fi

  ui_main
}
