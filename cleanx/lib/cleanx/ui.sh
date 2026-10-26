# 界面层：主菜单、类别勾选与开发子菜单；勾选结果只取编号。

# 没勾任何项时按正常返回处理，避免把「没选」当成错误。
cleanx_ui_checklist() {
  local out='' rc=0
  out=$(ui_checklist "$@") || rc=$?
  ((rc == TUI_EMPTY)) && return "$TUI_OK"
  ((rc == TUI_OK)) || return "$rc"
  printf '%s\n' "$out"
  return "$TUI_OK"
}

ui_clean_category() {
  local category=$1 title=$2
  local -a args=() ids=()
  local id size desc state total=0 picked=''

  collect_category "$category" || {
    info "没有可用的清理项：$title"
    return 0
  }

  for id in "${CAT_IDS[@]}"; do
    info "测量：${ITEM_LABEL[$id]}"
    size=$(item_size "$id" 2>/dev/null) || size=''
    if [[ -n $size ]]; then
      desc="${ITEM_LABEL[$id]}（$(format_size "$size")）"
    else
      desc="${ITEM_LABEL[$id]}（大小未知）"
    fi
    ((ITEM_ROOT[$id])) && desc+='，需 sudo'
    [[ -n ${ITEM_DESC[$id]} ]] && desc+="。${ITEM_DESC[$id]}"
    state=OFF
    ((ITEM_DEFAULT[$id])) && state=ON
    args+=("$id" "$desc" "$state")
  done

  picked=$(cleanx_ui_checklist "$title" '空格勾选，回车确认' "${args[@]}") || return 0
  [[ -n $picked ]] || return 0
  mapfile -t ids <<<"$picked"

  for id in "${ids[@]}"; do
    [[ -n $id ]] || continue
    size=$(item_size "$id" 2>/dev/null) || size=''
    [[ -n $size ]] && total=$((total + size))
  done

  if ((!DRY_RUN)); then
    ui_yesno '确认清理' "将清理 ${#ids[@]} 项，预计释放 $(format_size "$total")。继续？" || {
      info '已取消'
      return 0
    }
  fi

  run_selection "${ids[@]}"
}

ui_dev() {
  local choice
  while :; do
    choice=$(ui_menu 'cleanx / 开发' '选择操作' \
      clean '清理开发缓存（包管理器、IDE、Docker）' \
      build '扫描构建产物（只报告，不删除）' \
      back '返回') || return 0

    case "$choice" in
      clean) ui_clean_category dev 'cleanx / 开发缓存' ;;
      build) REPORT_PAGED=1; run_report build ;;
      back) return 0 ;;
    esac
  done
}

ui_scan() {
  REPORT_PAGED=1
  run_report big
}

ui_main() {
  local choice
  while :; do
    choice=$(ui_menu 'cleanx' '选择类别' \
      user '用户缓存与回收站' \
      system '系统包与日志（需要 sudo）' \
      dev '开发缓存与构建产物扫描' \
      scan '大文件扫描（只报告）' \
      quit '退出') || return 0

    case "$choice" in
      user) ui_clean_category user 'cleanx / 用户缓存' ;;
      system) ui_clean_category system 'cleanx / 系统包与日志' ;;
      dev) ui_dev ;;
      scan) ui_scan ;;
      quit) return 0 ;;
    esac
  done
}
