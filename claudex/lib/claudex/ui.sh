# 界面层：会话列表、动作菜单、归档恢复与缓存清理。

UI_DAYS=30

claudex_ui_checklist() {
  local out='' rc=0
  out=$(ui_checklist "$@") || rc=$?
  ((rc == TUI_EMPTY)) && return "$TUI_OK"
  ((rc == TUI_OK)) || return "$rc"
  printf '%s\n' "$out"
  return "$TUI_OK"
}

session_desc() {
  local idx=$1 desc
  desc="${S_TITLE[$idx]}，$(format_time "${S_MTIME[$idx]}")，$(format_size "${S_SIZE[$idx]}")"
  ((S_ACTIVE[$idx])) && desc+='，运行中'
  printf '%s\n' "$desc"
}

ui_session_detail() {
  local id=$1 idx out
  session_index_of "$id" || return 0
  idx=$S_CUR
  out=$(mktemp "${TMPDIR:-/tmp}/claudex-detail.XXXXXX") || return 0
  {
    printf '标题：%s\n' "${S_TITLE[$idx]}"
    printf '会话：%s\n' "${S_ID[$idx]}"
    printf '项目：%s\n' "${S_PROJECT[$idx]}"
    printf '路径：%s\n' "${S_CWD[$idx]:-未知}"
    printf '时间：%s\n' "$(format_time "${S_MTIME[$idx]}")"
    printf '大小：%s\n' "$(format_size "${S_SIZE[$idx]}")"
    printf '状态：%s\n' "$( ((S_ACTIVE[$idx])) && printf '运行中' || printf '未运行' )"
    printf '正文：%s\n' "${S_PATH[$idx]}"
    printf '会话目录：%s\n' "${S_SDIR[$idx]:-无}"
    printf '文件历史：%s\n' "${S_HIST[$idx]:-无}"
    printf '会话环境：%s\n' "${S_ENV[$idx]:-无}"
  } >"$out"
  ui_textbox '会话详情' "$out"
  rm -f -- "$out"
}

ui_session_actions() {
  local -a ids=("$@")
  local choice id total=0 r
  for id in "${ids[@]}"; do
    session_index_of "$id" || continue
    total=$((total + ${S_SIZE[$S_CUR]}))
  done

  while :; do
    choice=$(ui_menu 'claudex / 会话' "已选 ${#ids[@]} 个，合计 $(format_size "$total")" \
      resume '继续会话（claude --resume）' \
      archive '归档到 ~/.claude/archive' \
      delete '永久删除，不可恢复' \
      detail '查看会话详情' \
      back '返回') || return 0

    case "$choice" in
      resume)
        if ((${#ids[@]} != 1)); then
          info '继续会话只能选一个'
          continue
        fi
        if session_is_active "${ids[0]}"; then
          info '运行中的会话不能重复继续'
          continue
        fi
        resume_session "${ids[0]}"
        return $?
        ;;
      archive)
        if ((!DRY_RUN)); then
          ui_yesno '确认归档' "归档 ${#ids[@]} 个会话，合计 $(format_size "$total")？" || continue
        fi
        archive_sessions "${ids[@]}"
        return 0
        ;;
      delete)
        if ((!DRY_RUN)); then
          ui_yesno '确认删除' "永久删除 ${#ids[@]} 个会话，合计 $(format_size "$total")？删除后无法恢复。" || continue
        fi
        delete_sessions "${ids[@]}"
        return 0
        ;;
      detail)
        ui_session_detail "${ids[0]}"
        ;;
      back) return 0 ;;
    esac
  done
}

ui_session_pick() {
  local scope=$1 days=$2
  local id idx cutoff=0 now desc
  local -a args=() picked=() ids=()

  if ! session_scan "$scope"; then
    if [[ $scope == current ]]; then
      info "当前目录没有 Claude Code 会话，换到全部项目看看"
    else
      info '没有找到会话'
    fi
    return 0
  fi

  now=$(date +%s)
  ((days > 0)) && cutoff=$((now - days * 86400))

  for idx in "${!S_ID[@]}"; do
    ((cutoff > 0 && S_MTIME[idx] > cutoff)) && continue
    desc=$(session_desc "$idx")
    args+=("${S_ID[$idx]}" "$desc" OFF)
  done

  if ((${#args[@]} == 0)); then
    info "没有符合条件的会话"
    return 0
  fi

  picked=$(claudex_ui_checklist 'claudex / 会话' '空格勾选，回车确认' "${args[@]}") || return 0
  [[ -n $picked ]] || return 0
  mapfile -t ids <<<"$picked"
  ((${#ids[@]})) || return 0
  ui_session_actions "${ids[@]}"
}

ui_sessions_menu() {
  local choice days_input
  while :; do
    choice=$(ui_menu 'claudex / 会话列表' '选择范围' \
      current '当前项目，全部会话' \
      all '全部项目，全部会话' \
      current_old "当前项目，只看 ${UI_DAYS} 天前的" \
      all_old "全部项目，只看 ${UI_DAYS} 天前的" \
      days '修改天数' \
      back '返回') || return 0

    case "$choice" in
      current) ui_session_pick current 0 ;;
      all) ui_session_pick all 0 ;;
      current_old) ui_session_pick current "$UI_DAYS" ;;
      all_old) ui_session_pick all "$UI_DAYS" ;;
      days)
        days_input=$(ui_input '筛选天数' '只看多少天前的会话，0 表示不过滤' "$UI_DAYS") || continue
        [[ $days_input =~ ^[0-9]+$ ]] || { info '天数要写数字'; continue; }
        UI_DAYS=$((10#$days_input))
        ;;
      back) return 0 ;;
    esac
  done
}

ui_archives() {
  local choice idx
  local -a args=()
  if ! archive_entries; then
    info '还没有归档'
    return 0
  fi

  while :; do
    args=()
    for idx in "${!A_ID[@]}"; do
      args+=("$idx" "${A_DATE[$idx]}  ${A_TITLE[$idx]}  $(format_size "${A_SIZE[$idx]}")")
    done
    choice=$(ui_menu 'claudex / 归档' '选择要恢复的归档' "${args[@]}") || return 0
    [[ $choice =~ ^[0-9]+$ ]] || return 0

    if ((!DRY_RUN)); then
      ui_yesno '确认恢复' "把「${A_TITLE[$choice]}」恢复到原项目目录？" || { archive_entries; continue; }
    fi
    if restore_entry "$choice"; then
      archive_entries || return 0
    else
      return 1
    fi
  done
}

ui_cache() {
  local id size desc args=() picked='' total=0
  local -a ids=() selected=()

  if ! cache_collect; then
    info '没有可清理的缓存'
    return 0
  fi

  for id in "${CACHE_AVAILABLE[@]}"; do
    info "测量：${CACHE_LABEL[$id]}"
    size=$(cache_measure "$id" 2>/dev/null) || size=0
    desc="${CACHE_LABEL[$id]}（$(format_size "$size")）"
    [[ $id == cache.snapshots ]] && desc+="，${CACHE_DAYS} 天前"
    desc+="。${CACHE_DESC[$id]}"
    if ((CACHE_DEFAULT[$id])); then
      args+=("$id" "$desc" ON)
    else
      args+=("$id" "$desc" OFF)
    fi
  done

  picked=$(claudex_ui_checklist 'claudex / 缓存' '空格勾选，回车确认' "${args[@]}") || return 0
  [[ -n $picked ]] || return 0
  mapfile -t ids <<<"$picked"

  for id in "${ids[@]}"; do
    [[ -n $id ]] || continue
    selected+=("$id")
    size=$(cache_measure "$id" 2>/dev/null) || size=0
    total=$((total + size))
  done
  ((${#selected[@]})) || return 0

  if ((!DRY_RUN)); then
    ui_yesno '确认清理' "清理 ${#selected[@]} 项，预计释放 $(format_size "$total")？" || return 0
  fi
  cache_run "${selected[@]}"
}

ui_main() {
  local choice
  while :; do
    choice=$(ui_menu 'claudex' '选择功能' \
      sessions '会话列表：查看、继续、归档、删除' \
      archives '归档恢复：把归档会话放回原项目' \
      cache '缓存清理：旧快照、孤儿数据、插件缓存' \
      quit '退出') || return 0

    case "$choice" in
      sessions) ui_sessions_menu ;;
      archives) ui_archives ;;
      cache) ui_cache ;;
      quit) return 0 ;;
    esac
  done
}
