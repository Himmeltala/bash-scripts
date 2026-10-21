# 命令行层：命令注册表、帮助生成、参数解析、动作分发与主菜单，加载顺序放最后。
# 注册表每行六列以竖线分隔且内容不能含竖线：命令名|说明|收集函数|名词|参与编译判定|选择函数（空则统一复选）。
readonly COMMANDS=(
  'run|启动 Spring Boot 模块|collect_runnable|可运行模块|1|'
  'war|启动 war 项目（jetty/tomcat）|collect_war|war 项目|1|'
  'install|装顶层项目到本地仓库|collect_toplevel|顶层项目|0|select_install'
  'package|打可部署的 jar|collect_packable|可运行模块|0|'
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

在当前目录递归找目标，勾选后执行；不带参数时先选命令。

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

启动方式（只对 run 与 war 有效，命令行里后面写的覆盖前面的）:
  （不写）       自动：源码与各级 pom 都没比 target/classes 新就跳过编译
  -c, --compile  强制编译，就是手工敲 mvn 的效果
      --no-compile  跳过编译直接跑已有的 class，模块没编过时会报错退出
      --rebuild  先 clean 再编译后启动，改动大或判定猜错时用

跳过编译省下整个模块的重编时间：任一源码没有 class，Maven 就全量重编。

打包与装本地仓库参数:
  --no-am        package 与 install 按模块安装时去掉 -am，兄弟模块须已在本地仓库
  --no-clean     只对 package 有效，去掉 clean，增量打包最快，代价是残留的旧 class 会进 jar

package 默认 clean package -Dmaven.test.skip=true -am，兄弟模块一起构建。
install 直接选模块，默认带 -am 一起装兄弟模块。

带关键词时跳过勾选，按子串匹配标签或路径后执行；匹配同名目标时先写命令名，
例如 mvnx run install。

退出码: 0 成功，1 找到了目标但执行失败，2 用法错误，3 用户取消。
EOF
}

# 解析结果放全局。不用命令替换接：命令替换会开子 shell，函数里的赋值出不来。
ACTION=''
LIST_ONLY=0
REFRESH=0
# --no-am 由 package 与 install 共用，NO_AM_FLAG 只在报错时回显用户写的那个参数。
NO_AM=0
NO_AM_FLAG=''
declare -a POSITIONAL=()
declare -a UI_ACTION_ITEMS=()

# 命令名是否登记在注册表里，加命令不必改这里。
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
      --no-am) NO_AM=1; NO_AM_FLAG=$a ;;
      --no-clean) PACK_NO_CLEAN=1; PACK_NO_CLEAN_FLAG=$a ;;
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

# 执行一个动作。$1 是命令名，$2 起是位置参数，只取第一个当关键词。
run_action() {
  local cmd=$1
  shift
  local kw=${1:-}

  local noun collector allow_skip selector
  noun=$(command_field "$cmd" 4)
  collector=$(command_field "$cmd" 3)
  allow_skip=$(command_field "$cmd" 5)
  selector=$(command_field "$cmd" 6)

  # 跳过编译与 clean 只对能直接启动的命令有意义，install 与 package 必须真编译。
  if [[ $allow_skip -eq 0 && $START_MODE != "$MODE_AUTO" && $START_MODE != "$MODE_COMPILE" ]]; then
    usage_error "「$cmd」命令不支持 $MODE_FLAG"
  fi

  # --no-am 只对 package 与 install 按模块安装有意义，--no-clean 只属于 package。
  if [[ -n "$NO_AM_FLAG" && "$cmd" != "$PACKAGE_COMMAND" && "$cmd" != "$INSTALL_COMMAND" ]]; then
    usage_error "「$cmd」命令不支持 $NO_AM_FLAG"
  fi
  if [[ -n "$PACK_NO_CLEAN_FLAG" && "$cmd" != "$PACKAGE_COMMAND" ]]; then
    usage_error "「$cmd」命令不支持 $PACK_NO_CLEAN_FLAG"
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
      out=$(mvnx_ui_checklist "$noun" "${recs[@]}") || rc=$?
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
  [[ -z "$selector" || -n "$kw" ]] && save_selection "${chosen[@]}"

  # 明说跳过编译时得有东西可执行，模块没编过就报错，不硬起一个空壳。
  if [[ $START_MODE == "$MODE_NO_COMPILE" ]]; then
    local r wd pl dir
    for r in "${chosen[@]}"; do
      IFS=$FS read -r _ wd pl _ _ _ <<< "$r"
      dir=$wd
      [[ -n "$pl" ]] && dir="$wd/$pl"
      [[ -d "$dir/target/classes" ]] ||
        die "「$(relative_to_pwd "$dir")」没有 target/classes，先编译或去掉 $MODE_FLAG" "$EXIT_USAGE"
    done
  fi

  # 启动方式只改传给 mvn 的参数，目标本身照旧。
  mapfile -t chosen < <(printf '%s\n' "${chosen[@]}" | apply_start_mode "$allow_skip")

  # 单条记录会 exec 成 mvn，正常情况下回不来；能回来只可能是工作目录进不去。
  launch_records "${chosen[@]}" || die '执行失败，工作目录可能不存在'
}

# 不带参数时的主菜单：先选动作再勾目标，执行完或返回上一步都回到这里，选退出才离开。
ui_main() {
  local action rc=0
  while :; do
    action=$(ui_menu 'mvnx' '选命令' "${UI_ACTION_ITEMS[@]}") || return "$EXIT_CANCEL"
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
  command -v mvn >/dev/null || die '找不到 mvn，确认 Maven 在 PATH 中'
  # 终端探测只做一次且必须在命令替换之前，替换里的 stdout 是管道，那时 [[ -t 1 ]] 永远为假。
  detect_ui_mode
  build_action_items

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

  ui_main
}
