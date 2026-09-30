# 命令行层：命令注册表、帮助生成、参数解析、动作分发与主菜单。
# 加载顺序放在最后，它引用的收集函数与判定函数必须已经就位。
# 注册表每行五列，用竖线隔开，各列内容里不能出现竖线：
#   命令名 | 说明 | 收集函数 | 目标的名词（只用在提示语里）| 是否参与编译判定（1 参与）
readonly COMMANDS=(
  'run|启动可运行的 Spring Boot 模块|collect_runnable|可运行模块|1'
  'install|把顶层项目 clean install 装进本地仓库|collect_toplevel|顶层项目|0'
  'package|把可运行模块打成可部署的 jar|collect_packable|可运行模块|0'
)
readonly DEFAULT_COMMAND='run'

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
用法: mvnx [命令] [选项] [关键词]

在当前目录下递归查找目标，勾选后执行对应命令。不带参数时先选命令再选目标。

命令:
EOF
  local row
  for row in "${COMMANDS[@]}"; do
    printf '  %-10s %s\n' "${row%%|*}" "$(command_field "${row%%|*}" 2)"
  done

  cat <<'EOF'

选项:
  -l, --list     只列出目标，不执行；没写命令时按 run 列
      --refresh  清掉当前命令上次的勾选记录，重新开始
  -h, --help     显示本帮助
      --         终止选项解析，后面的词一律当关键词

启动方式（只对 run 有效，命令行里后面写的覆盖前面的）:
  （不写）       自动：源码与各级 pom 都没比 target/classes 新就跳过编译
  -c, --compile  强制编译，就是手工敲 mvn 的效果
      --no-compile  跳过编译直接跑已有的 class，模块没编过时会报错退出
      --rebuild  先 clean 再编译后启动，改动大或判定猜错时用

跳过编译省下的是整个模块的重编时间。Maven 只要发现任何一个源文件没有对应的
class 文件，就会把整个模块重编一遍，整份被注释掉的源文件正好会一直触发它。

打包参数（只对 package 有效）:
  （不写）       默认 clean package -Dmaven.test.skip=true -am，兄弟模块一起构建
      --no-am    去掉 -am，兄弟模块必须在本地仓库里，省下拉起它们的时间
      --no-clean 去掉 clean，增量打包最快，代价是残留的旧 class 会进 jar

带关键词时跳过勾选界面，按关键词匹配标签或路径（不区分大小写，按子串匹配）
后直接执行。要按关键词匹配与命令同名的目标时，把命令名写在前面，
例如 mvnx run install。

退出码: 0 成功，1 找到了目标但执行失败，2 用法错误，3 用户取消。
EOF
}

# 解析结果放全局。不用命令替换接：命令替换会开子 shell，函数里的赋值出不来。
ACTION=''
LIST_ONLY=0
REFRESH=0
declare -a POSITIONAL=()
declare -a UI_ACTION_ITEMS=()

# 命令名是否登记在注册表里，判断跟着注册表走，加命令不必改这里。
is_action() { command_exists "$1"; }

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
      --refresh) REFRESH=1 ;;
      -c|--compile) START_MODE=$MODE_COMPILE; MODE_FLAG=$a ;;
      --no-compile) START_MODE=$MODE_NO_COMPILE; MODE_FLAG=$a ;;
      --rebuild) START_MODE=$MODE_REBUILD; MODE_FLAG=$a ;;
      --no-am) PACK_NO_AM=1; PACK_FLAG=$a ;;
      --no-clean) PACK_NO_CLEAN=1; PACK_FLAG=$a ;;
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

# 主菜单的选项从注册表生成，加命令时不必改这里；末尾补一项退出。
build_action_items() {
  UI_ACTION_ITEMS=()
  local row name
  for row in "${COMMANDS[@]}"; do
    name="${row%%|*}"
    UI_ACTION_ITEMS+=("$name" "$(command_field "$name" 2)")
  done
  UI_ACTION_ITEMS+=('quit' '退出')
}

# 跑一个动作。$1 是命令名，$2 起是位置参数，只取第一个当关键词。
run_action() {
  local cmd=$1
  shift
  local kw=${1:-}

  local noun collector allow_skip
  noun=$(command_field "$cmd" 4)
  collector=$(command_field "$cmd" 3)
  allow_skip=$(command_field "$cmd" 5)

  # 跳过编译与 clean 只对能直接启动的命令有意义，install 与 package 必须真编译。
  if [[ $allow_skip -eq 0 && $START_MODE != "$MODE_AUTO" && $START_MODE != "$MODE_COMPILE" ]]; then
    usage_error "「$cmd」命令不支持 $MODE_FLAG"
  fi

  # 这两个开关拼的是 package 自己的参数，别的命令带上没有意义。
  if [[ -n "$PACK_FLAG" && "$cmd" != "$PACKAGE_COMMAND" ]]; then
    usage_error "「$cmd」命令不支持 $PACK_FLAG"
  fi

  mkdir -p "$CACHE_DIR"
  local key
  key=$(printf '%s' "$PWD" | md5sum | cut -c1-16)
  SEL_FILE="$CACHE_DIR/$key.$cmd.selected"
  ((REFRESH)) && rm -f "$SEL_FILE"

  # 解析在主 shell 里做，收集函数在子 shell 里只读这些数组。
  prepare_scan "$PWD"

  local -a recs=()
  mapfile -t recs < <("$collector" | assign_tags)
  [[ ${#recs[@]} -gt 0 ]] || die "当前目录下没有找到$noun"

  local rec tag workdir plpath mvnargs display cmdtext
  if ((LIST_ONLY)); then
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
      printf '%-40s %s\n' "$tag" "$cmdtext"
    done
    return 0
  fi

  local -a chosen=()
  local out
  if [[ -n "$kw" ]]; then
    local lower="${kw,,}"
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
      # 一并拿工作目录的绝对路径来匹配。就在项目目录里执行时，展示路径会退化成
      # 「.」，只按它匹配的话关键词根本落不到项目名上。
      if [[ "${tag,,}" == *"$lower"* ]] ||
         [[ "${display,,}" == *"$lower"* ]] ||
         [[ "${workdir,,}" == *"$lower"* ]]; then
        chosen+=("$rec")
      fi
    done
    [[ ${#chosen[@]} -gt 0 ]] || die "没有$noun匹配关键词 $kw"
  else
    # 取消与一个都没勾都算用户取消，退 3，与「跑失败了」的 1 分开。
    local rc=0
    out=$(ui_checklist "$noun" "${recs[@]}") || rc=$?
    case "$rc" in
      0) : ;;
      1) die '已取消' "$EXIT_CANCEL" ;;
      *) die "一个$noun都没勾" "$EXIT_CANCEL" ;;
    esac
    mapfile -t chosen <<< "$out"
  fi

  save_selection "${chosen[@]}"

  # 明说跳过编译时得有东西可跑，模块没编过就报错，不硬起一个空壳。
  if [[ $START_MODE == "$MODE_NO_COMPILE" ]]; then
    local r wd pl dir
    for r in "${chosen[@]}"; do
      IFS=$FS read -r _ wd pl _ _ _ <<< "$r"
      dir=$wd
      [[ -n "$pl" ]] && dir="$wd/$pl"
      [[ -d "$dir/target/classes" ]] ||
        die "「$(relative_to_pwd "$dir")」下没有 target/classes，跳过编译没有可跑的东西；先编译一次，或去掉 $MODE_FLAG" "$EXIT_USAGE"
    done
  fi

  # 启动方式只改传给 mvn 的参数，目标本身照旧。
  mapfile -t chosen < <(printf '%s\n' "${chosen[@]}" | apply_start_mode "$allow_skip")

  # 单条记录会 exec 成 mvn，正常情况下回不来；能回来只可能是工作目录进不去。
  launch_records "${chosen[@]}" || die '执行失败，检查工作目录是否存在'
}

# 不带参数时的主菜单：先选动作，再进目标勾选。动作跑完回到这里，选退出才离开。
ui_main() {
  local action
  while :; do
    action=$(ui_menu 'mvnx' '选一个动作' "${UI_ACTION_ITEMS[@]}") || return "$EXIT_CANCEL"
    [[ "$action" == 'quit' ]] && break
    run_action "$action"
  done
  return 0
}

main() {
  parse_args "$@"
  command -v mvn >/dev/null || die '找不到 mvn，先确认 Maven 在 PATH 里'
  # 终端探测只做一次，必须在任何命令替换之前：界面函数是 out=$(ui_checklist ...)
  # 这样调的，替换里的 stdout 是管道，那时候再判 [[ -t 1 ]] 永远为假。
  detect_ui_mode
  build_action_items

  if [[ -n "$ACTION" ]]; then
    run_action "$ACTION" "${POSITIONAL[@]}"
    return $?
  fi

  # 没写命令：带了位置参数（关键词）或 --list 就按默认命令跑，此外进主菜单。
  # --list 也走默认命令，为了列个清单先让人选一次动作没有意义。
  if ((${#POSITIONAL[@]})) || ((LIST_ONLY)); then
    run_action "$DEFAULT_COMMAND" "${POSITIONAL[@]}"
    return $?
  fi

  ui_main
}
