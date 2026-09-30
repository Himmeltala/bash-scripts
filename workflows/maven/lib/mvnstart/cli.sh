# 命令行层：命令注册表、帮助生成、参数解析与主流程。
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
用法: mvnstart [命令] [选项] [关键词]

在当前目录下递归查找目标，勾选后执行对应命令。

不写命令时用 run。首个非选项参数命中命令名就按命令处理，否则当作关键词。
例如 mvnstart admin 是启动匹配 admin 的模块，mvnstart install 是构建顶层项目，
mvnstart package 是把勾选的模块打成 jar。

命令:
EOF
  local row
  for row in "${COMMANDS[@]}"; do
    printf '  %-10s %s\n' "${row%%|*}" "$(command_field "${row%%|*}" 2)"
  done

  cat <<'EOF'

每条命令另有同名入口，用法与把命令名写在前面完全一样：
  mvnstart-run、mvnstart-install、mvnstart-package

选项:
  -l, --list     只列出目标，不执行
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
例如 mvnstart run install。
EOF
}

main() {
  local -a rest=() args=("$@")
  local refresh=0 list_only=0 end_opts=0 i=0 arg
  while ((i < ${#args[@]})); do
    arg=${args[$i]}
    i=$((i + 1))
    # -- 之后的词一律当关键词，关键词里带减号也不怕
    if ((end_opts == 1)); then
      rest+=("$arg")
      continue
    fi
    case "$arg" in
      --) end_opts=1 ;;
      -h|--help) usage; exit 0 ;;
      -l|--list) list_only=1 ;;
      --refresh) refresh=1 ;;
      -c|--compile) START_MODE=$MODE_COMPILE; MODE_FLAG=$arg ;;
      --no-compile) START_MODE=$MODE_NO_COMPILE; MODE_FLAG=$arg ;;
      --rebuild) START_MODE=$MODE_REBUILD; MODE_FLAG=$arg ;;
      --no-am) PACK_NO_AM=1; PACK_FLAG=$arg ;;
      --no-clean) PACK_NO_CLEAN=1; PACK_FLAG=$arg ;;
      -*) usage_error "未知选项 $arg" ;;
      *) rest+=("$arg") ;;
    esac
  done

  # 入口文件把默认命令写在 MVNSTART_DEFAULT_COMMAND 里；直接跑本文件时没有它，
  # 退回 DEFAULT_COMMAND。两个来源都要在注册表里，写错了在这里直接报出来，
  # 否则后面 command_field 会安静地取回空值，错在更远的地方。
  local cmd="${MVNSTART_DEFAULT_COMMAND:-$DEFAULT_COMMAND}"
  command_exists "$cmd" || die "入口选定的命令 $cmd 没有登记在 COMMANDS 里"
  if [[ ${#rest[@]} -gt 0 ]] && command_exists "${rest[0]}"; then
    cmd="${rest[0]}"
    rest=("${rest[@]:1}")
  fi
  local kw="${rest[0]:-}"

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

  command -v mvn >/dev/null || die '找不到 mvn，先确认 Maven 在 PATH 里'

  mkdir -p "$CACHE_DIR"
  local key
  key=$(printf '%s' "$PWD" | md5sum | cut -c1-16)
  SEL_FILE="$CACHE_DIR/$key.$cmd.selected"
  [[ $refresh -eq 1 ]] && rm -f "$SEL_FILE"

  # 解析在主 shell 里做，收集函数在子 shell 里只读这些数组。
  prepare_scan "$PWD"

  local -a recs=()
  mapfile -t recs < <("$collector" | assign_tags)
  [[ ${#recs[@]} -gt 0 ]] || die "当前目录下没有找到$noun"

  local rec tag workdir plpath mvnargs display cmdtext
  if [[ $list_only -eq 1 ]]; then
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
    local rc=0
    if command -v whiptail >/dev/null 2>&1 && [[ -t 0 && -t 1 && -t 2 ]]; then
      out=$(whiptail_choose "${recs[@]}") || rc=$?
    else
      out=$(plain_choose "$noun" "${recs[@]}") || rc=$?
    fi
    case "$rc" in
      0) : ;;
      1) die '已取消' ;;
      *) die "一个$noun都没勾" ;;
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
        die "「$(relative_to_pwd "$dir")」下没有 target/classes，跳过编译没有可跑的东西；先编译一次，或去掉 $MODE_FLAG" 2
    done
  fi

  # 启动方式只改传给 mvn 的参数，目标本身照旧。
  mapfile -t chosen < <(printf '%s\n' "${chosen[@]}" | apply_start_mode "$allow_skip")

  # 单条记录会 exec 成 mvn，正常情况下回不来；能回来只可能是工作目录进不去。
  launch_records "${chosen[@]}" || die '执行失败，检查工作目录是否存在'
}
