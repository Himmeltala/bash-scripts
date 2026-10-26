# 命令行层：帮助、参数解析、类别分发与主菜单入口，加载顺序放最后。

usage() {
  cat <<'EOF'
用法: cleanx [选项] [类别 [清理项...]]

不带类别时打开菜单。带类别时默认只列清单与大小，加 --yes 才删除。

类别:
  user        用户缓存、浏览器缓存、回收站
  system      包缓存、systemd 日志、临时目录（需要 sudo）
  dev         包管理器缓存、IDE 缓存、Docker 悬空镜像
  scan        扫描家目录大文件，只报告
  build-scan  扫描构建产物目录，只报告
  list        列出清理项

选项:
  -y, --yes          真正执行清理；不带时只预览
  -n, --dry-run      只预览，即使给了 --yes
      --top N        扫描报告列出前 N 条，默认 30
      --min-size 大小  大文件阈值，支持 k、M、G，默认 500M；只给数字按字节算
  -h, --help         显示本帮助

清理项不写时执行该类别里默认勾选的项；写清理项编号可以指定，多个编号用空格分隔。

退出码: 0 成功，1 有项没完成，2 用法错误，3 用户取消。
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到 $1，先安装"
}

CATEGORY=''
declare -a ITEM_IDS_ARG=()
EXPLICIT_DRY=0

known_category() {
  case "$1" in
    user|system|dev|scan|build-scan|list) return 0 ;;
  esac
  return 1
}

parse_args() {
  local arg
  while (($#)); do
    arg=$1
    case "$arg" in
      -y|--yes) ASSUME_YES=1; ((EXPLICIT_DRY)) || DRY_RUN=0; shift ;;
      -n|--dry-run) DRY_RUN=1; EXPLICIT_DRY=1; shift ;;
      --top)
        (($# >= 2)) || usage_error "$arg 后面要跟条数"
        set_top "$2"
        shift 2
        ;;
      --top=*) set_top "${arg#*=}"; shift ;;
      --min-size)
        (($# >= 2)) || usage_error "$arg 后面要跟大小"
        set_min_size "$2"
        shift 2
        ;;
      --min-size=*) set_min_size "${arg#*=}"; shift ;;
      -h|--help) usage; exit 0 ;;
      --)
        shift
        while (($#)); do
          if [[ -z $CATEGORY ]]; then CATEGORY=$1; else ITEM_IDS_ARG+=("$1"); fi
          shift
        done
        ;;
      -*) usage_error "未知选项 $arg" ;;
      *)
        if [[ -z $CATEGORY ]]; then
          known_category "$arg" || usage_error "未知类别 $arg"
          CATEGORY=$arg
        else
          ITEM_IDS_ARG+=("$arg")
        fi
        shift
        ;;
    esac
  done
}

cmd_list() {
  local filter=${1:-} id avail mark rootmark
  printf '%-16s %-8s %-5s %-5s %s\n' '编号' '类别' '默认' 'sudo' '标题'
  for id in "${ITEM_IDS[@]}"; do
    [[ -z $filter || ${ITEM_CATEGORY[$id]} == "$filter" ]] || continue
    avail='可用'
    item_available "$id" || avail='不适用'
    mark='否'
    ((ITEM_DEFAULT[$id])) && mark='是'
    rootmark='-'
    ((ITEM_ROOT[$id])) && rootmark='是'
    printf '%-16s %-8s %-5s %-5s %s（%s）\n' \
      "$id" "${ITEM_CATEGORY[$id]}" "$mark" "$rootmark" "${ITEM_LABEL[$id]}" "$avail"
  done
}

cmd_category() {
  local category=$1 id
  local -a ids=()

  if ((${#ITEM_IDS_ARG[@]})); then
    for id in "${ITEM_IDS_ARG[@]}"; do
      item_exists "$id" || usage_error "没有清理项 $id"
      [[ ${ITEM_CATEGORY[$id]} == "$category" ]] || usage_error "清理项 $id 不属于类别 $category"
      if ! item_available "$id"; then
        warn "清理项 $id 在当前机器上不可用，跳过"
        continue
      fi
      ids+=("$id")
    done
  else
    collect_category "$category" || die "类别 $category 没有可用的清理项"
    for id in "${CAT_IDS[@]}"; do
      ((ITEM_DEFAULT[$id])) && ids+=("$id")
    done
  fi

  ((${#ids[@]})) || die '没有可执行的清理项'
  show_selection "${ids[@]}"
  run_selection "${ids[@]}"
}

main() {
  parse_args "$@"
  detect_ui_mode
  need_cmd du
  need_cmd find
  need_cmd sort
  need_cmd awk
  need_cmd mktemp
  need_cmd realpath

  if [[ -z $CATEGORY ]]; then
    # 菜单里每一步都有交互确认，默认直接执行；加 -n 才只预览。
    ((EXPLICIT_DRY)) || DRY_RUN=0
    ui_main
    return $?
  fi

  case "$CATEGORY" in
    scan) run_report big ;;
    build-scan) run_report build ;;
    list) cmd_list "${ITEM_IDS_ARG[0]:-}" ;;
    user|system|dev) cmd_category "$CATEGORY" ;;
  esac
}
