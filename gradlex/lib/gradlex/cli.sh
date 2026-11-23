# 命令行层：命令注册表、帮助生成、参数解析、动作分发与主菜单，加载顺序放最后。
# 注册表每行六列以竖线分隔且内容不能含竖线：命令名|说明|收集函数|名词|参与构建参数|选择函数（空则统一复选）。
readonly COMMANDS=(
  'run|启动可运行模块（Boot/application/web）|collect_runnable|可运行模块|1|'
  'build|构建可运行模块（bootJar/assemble）|collect_buildable|可构建模块|1|'
)
readonly DEFAULT_COMMAND='run'

usage() {
  cat <<'EOF'
用法: gradlex [命令] [选项] [关键词]

在当前目录递归找 Gradle 构建与可运行模块，勾选后执行；不带参数时先选命令。

命令:
EOF
  local row
  for row in "${COMMANDS[@]}"; do
    printf '  %-10s %s\n' "${row%%|*}" "$(shell_command_field "${row%%|*}" 2)"
  done

  cat <<'EOF'

选项:
  -l, --list     只列出目标，不执行；没写命令时按 run 列
      --reset    清掉当前命令上次的勾选记录，重新开始
  -h, --help     显示本帮助
      --         终止选项解析，后面的词一律当关键词

机器接口（供 idex 的 JVM 引擎调用）:
  gradlex --list --json [命令]   输出目标 JSON
  gradlex exec --id <id>         执行单个目标
      --args "参数"              追加到任务尾部

构建参数（run 与 build 都可用，可同时写）:
  --rebuild      任务前加 clean，先清理再执行
      --refresh  追加 --refresh-dependencies，强制刷新依赖

默认直接执行任务，不 clean，不跳过编译，增量交给 Gradle 自己判断。

Gradle 入口优先用 GRADLEX_GRADLE，其次项目里最近的 gradlew，最后 PATH 里的 gradle。
gradlew 带 CRLF 换行时在 Linux 上跑不起来，会警告并改用系统 gradle；找不到 gradle 才报错。

带关键词时跳过勾选，按子串匹配标签或路径后执行；匹配同名目标时先写命令名，
例如 gradlex run admin。

退出码: 0 成功，1 找到了目标但执行失败，2 用法错误，3 用户取消。
EOF
}

# 解析结果放全局。不用命令替换接：命令替换会开子 shell，函数里的赋值出不来。
ACTION=''
LIST_ONLY=0
JSON_ONLY=0
RESET_SELECTION=0
MACHINE_EXEC=0
EXEC_ID=''
EXTRA_ARGS=''
declare -a POSITIONAL=()
declare -a UI_ACTION_ITEMS=()

# 命令名是否登记在注册表里，加命令不必改这里。
is_action() { shell_command_exists "$1"; }

parse_args() {
  local -a args=("$@")
  local end_opts=0 i=0 a
  while ((i < ${#args[@]})); do
    a=${args[$i]}
    i=$((i + 1))

    # -- 之后的词一律当关键词，关键词里带减号也不怕
    if ((end_opts)); then
      POSITIONAL+=("$a")
      continue
    fi

    case "$a" in
      --) end_opts=1 ;;
      -h|--help) usage; exit 0 ;;
      -l|--list) LIST_ONLY=1 ;;
      --reset) RESET_SELECTION=1 ;;
      --rebuild) REBUILD=1 ;;
      --refresh) REFRESH_DEPS=1 ;;
      --json) JSON_ONLY=1 ;;
      exec) if [[ -z "$ACTION" ]]; then MACHINE_EXEC=1; else POSITIONAL+=("$a"); fi ;;
      --id) EXEC_ID=${args[$i]:-}; i=$((i + 1)) ;;
      --args) EXTRA_ARGS=${args[$i]:-}; i=$((i + 1)) ;;
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

# 执行一个动作。$1 是命令名，$2 起是位置参数，只取第一个当关键词。
run_action() {
  local cmd=$1
  shift
  local kw=${1:-}

  local noun collector selector
  noun=$(shell_command_field "$cmd" 4)
  collector=$(shell_command_field "$cmd" 3)
  selector=$(shell_command_field "$cmd" 6)

  mkdir -p "$CACHE_DIR"
  local key
  key=$(printf '%s' "$PWD" | md5sum | cut -c1-16)
  SEL_FILE="$CACHE_DIR/$key.$cmd.selected"
  ((RESET_SELECTION)) && rm -f "$SEL_FILE"

  # 解析在主 shell 里做，收集函数在子 shell 里只读这些数组。
  prepare_scan "$PWD"

  local -a recs=()
  mapfile -t recs < <("$collector" | shell_assign_tags | apply_start_mode)
  if ((LIST_ONLY && JSON_ONLY)); then
    shell_machine_json "$cmd" machine_collect
    return 0
  fi
  [[ ${#recs[@]} -gt 0 ]] || die "当前目录下没有找到$noun"

  local rec tag workdir projectpath taskargs display cmdtext
  if ((LIST_ONLY)); then
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
      printf '%-40s %s\n' "$tag" "$cmdtext"
    done
    return 0
  fi

  local -a chosen=()
  local out
  if [[ -n "$kw" ]]; then
    local lower="${kw,,}"
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
      # 也拿工作目录绝对路径匹配：在项目目录里执行时展示路径会退化成「.」，只按它匹配会落不到项目名上。
      if [[ "${tag,,}" == *"$lower"* ]] ||
         [[ "${display,,}" == *"$lower"* ]] ||
         [[ "${workdir,,}" == *"$lower"* ]]; then
        chosen+=("$rec")
      fi
    done
    [[ ${#chosen[@]} -gt 0 ]] || die "没有$noun匹配关键词 $kw"
  else
    # 取消与一个都没勾都算用户取消，退 3；返回上一步单独退 4，交给主菜单处理。
    local rc=0
    if [[ -n "$selector" ]]; then
      out=$("$selector" "$noun" "${recs[@]}") || rc=$?
    else
      out=$(shell_ui_checklist "$noun" "${recs[@]}") || rc=$?
    fi
    case "$rc" in
      0) : ;;
      4) return "$EXIT_BACK" ;;
      1) die '已取消' "$EXIT_CANCEL" ;;
      *)
        if [[ -n "$selector" ]]; then
          die '没有选中任何目标' "$EXIT_CANCEL"
        else
          die "一个$noun都没勾" "$EXIT_CANCEL"
        fi
        ;;
    esac
    mapfile -t chosen <<< "$out"
  fi

  # 自带选择函数的命令在函数里写勾选记录。
  [[ -z "$selector" || -n "$kw" ]] && shell_save_selection "${chosen[@]}"

  # 单条记录会 exec 成 Gradle，正常情况下回不来；能回来只可能是工作目录进不去。
  shell_launch_records launch_one "${chosen[@]}" || die '执行失败，工作目录可能不存在'
}

main() {
  parse_args "$@"

  # 机器接口：idex 的 JVM 引擎按 id 调一个目标，不经过菜单与勾选。
  if ((MACHINE_EXEC)); then
    machine_exec
    return
  fi
  if [[ -n "$EXEC_ID" || -n "$EXTRA_ARGS" ]]; then
    usage_error '--id 与 --args 只用于 exec'
  fi
  # 终端探测只做一次且必须在命令替换之前，替换里的 stdout 是管道，那时 [[ -t 1 ]] 永远为假。
  ui_detect
  shell_build_action_items

  # 直接写命令时没有上一步可回，返回与取消同义。
  local rc=0
  if [[ -n "$ACTION" ]]; then
    run_action "$ACTION" "${POSITIONAL[@]}" || rc=$?
    ((rc == EXIT_BACK)) && rc=$EXIT_CANCEL
    return "$rc"
  fi

  # 没写命令：带位置参数（关键词）或 --list 就执行默认命令，否则进主菜单。
  if ((${#POSITIONAL[@]})) || ((LIST_ONLY)); then
    run_action "$DEFAULT_COMMAND" "${POSITIONAL[@]}" || rc=$?
    ((rc == EXIT_BACK)) && rc=$EXIT_CANCEL
    return "$rc"
  fi

  shell_ui_main
}
