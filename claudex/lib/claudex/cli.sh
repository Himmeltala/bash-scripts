# 命令行层：帮助、参数解析与动作分发，加载顺序放最后。

usage() {
  cat <<'EOF'
用法: claudex [选项] [命令 [参数...]]

不带命令时打开菜单。

命令:
  list [--all] [--older-than 天数]   列出会话
  resume <会话id或前缀>               切到原目录并执行 claude --resume
  archive <会话id...>                 归档会话，默认只预览
  delete <会话id...>                  永久删除会话，默认只预览
  archives                            列出归档条目
  restore [会话id]                    恢复归档，默认只预览
  cache [编号...] [--days 天数]       清理 Claude Code 缓存，默认只预览

选项:
  -y, --yes          真正执行；不带时归档、删除、恢复、缓存只预览
  -n, --dry-run      只预览，即使给了 --yes
      --all          list 时列出全部项目
      --older-than N list 时只看 N 天前修改的会话
      --days N       缓存清理的天数阈值，默认 7
  -h, --help         显示本帮助

会话 id 支持唯一前缀，至少 4 位；匹配多个时会列出候选。

退出码: 0 成功，1 有项没完成，2 用法错误，3 用户取消。
EOF
}

CMD=''
declare -a ARGS=()
ALL=0
OLDER_DAYS=0
EXPLICIT_DRY=0

need_value() {
  local opt=$1 val=${2:-}
  [[ -n $val ]] || usage_error "$opt 后面要跟一个值"
}

parse_args() {
  local arg
  while (($#)); do
    arg=$1
    case "$arg" in
      -y|--yes) ASSUME_YES=1; ((EXPLICIT_DRY)) || DRY_RUN=0; shift ;;
      -n|--dry-run) DRY_RUN=1; EXPLICIT_DRY=1; shift ;;
      --all) ALL=1; shift ;;
      --older-than)
        (($# >= 2)) || usage_error "$arg 后面要跟天数"
        [[ $2 =~ ^[0-9]+$ ]] || usage_error "天数 $2 不是数字"
        OLDER_DAYS=$((10#$2))
        shift 2
        ;;
      --older-than=*)
        arg=${arg#*=}
        [[ $arg =~ ^[0-9]+$ ]] || usage_error "天数 $arg 不是数字"
        OLDER_DAYS=$((10#$arg))
        shift
        ;;
      --days)
        (($# >= 2)) || usage_error "$arg 后面要跟天数"
        [[ $2 =~ ^[0-9]+$ ]] || usage_error "天数 $2 不是数字"
        CACHE_DAYS=$((10#$2))
        shift 2
        ;;
      --days=*)
        arg=${arg#*=}
        [[ $arg =~ ^[0-9]+$ ]] || usage_error "天数 $arg 不是数字"
        CACHE_DAYS=$((10#$arg))
        shift
        ;;
      -h|--help) usage; exit 0 ;;
      --)
        shift
        while (($#)); do
          if [[ -z $CMD ]]; then CMD=$1; else ARGS+=("$1"); fi
          shift
        done
        ;;
      -*) usage_error "未知选项 $arg" ;;
      *)
        if [[ -z $CMD ]]; then CMD=$arg; else ARGS+=("$arg"); fi
        shift
        ;;
    esac
  done
}

cmd_list() {
  local idx cutoff=0 count=0
  if ((ALL)); then session_scan all || true; else session_scan current || true; fi
  ((OLDER_DAYS > 0)) && cutoff=$(( $(date +%s) - OLDER_DAYS * 86400 ))

  printf '%-38s  %-16s  %-9s  %s\n' '会话' '时间' '大小' '标题'
  for idx in "${!S_ID[@]}"; do
    ((cutoff > 0 && S_MTIME[idx] > cutoff)) && continue
    count=$((count + 1))
    printf '%-38s  %-16s  %-9s  %s%s\n' \
      "${S_ID[$idx]}" "$(format_time "${S_MTIME[$idx]}")" \
      "$(format_size "${S_SIZE[$idx]}")" "${S_TITLE[$idx]}" \
      "$( ((S_ACTIVE[$idx])) && printf ' [运行中]' )"
  done
  ((count > 0)) || info '没有符合条件的会话'
  return 0
}

resolve_session_args() {
  local a rc=0
  RESOLVED=()
  for a in "$@"; do
    session_match_prefix "$a" || rc=$?
    ((rc == 0)) || return "$rc"
    RESOLVED+=("$SESSION_PICKED")
  done
}

cmd_resume() {
  ((${#ARGS[@]} == 1)) || usage_error 'resume 要且只要一个会话 id'
  session_scan all || die '没有找到会话'
  session_match_prefix "${ARGS[0]}" || return $?
  resume_session "$SESSION_PICKED"
}

cmd_archive() {
  ((${#ARGS[@]})) || usage_error 'archive 后面要跟会话 id'
  session_scan all || die '没有找到会话'
  resolve_session_args "${ARGS[@]}" || return $?
  archive_sessions "${RESOLVED[@]}"
}

cmd_delete() {
  ((${#ARGS[@]})) || usage_error 'delete 后面要跟会话 id'
  session_scan all || die '没有找到会话'
  resolve_session_args "${ARGS[@]}" || return $?
  delete_sessions "${RESOLVED[@]}"
}

cmd_archives() {
  if ! archive_entries; then
    info '还没有归档'
    return 0
  fi
  printf '%-12s  %-38s  %-9s  %s\n' '归档日期' '会话' '大小' '标题'
  local idx
  for idx in "${!A_ID[@]}"; do
    printf '%-12s  %-38s  %-9s  %s\n' \
      "${A_DATE[$idx]}" "${A_ID[$idx]}" "$(format_size "${A_SIZE[$idx]}")" "${A_TITLE[$idx]}"
  done
}

find_archive_index() {
  local want=$1 idx
  local -a exact=() hits=()
  ARCHIVE_PICK=-1
  for idx in "${!A_ID[@]}"; do
    [[ ${A_ID[$idx]} == "$want" ]] && exact+=("$idx")
  done
  if ((${#exact[@]} == 1)); then
    ARCHIVE_PICK=${exact[0]}
    return 0
  fi
  if ((${#exact[@]} > 1)); then
    warn "归档会话 $want 出现在多个日期下："
    for idx in "${exact[@]}"; do
      printf '  %s  %s  %s\n' "${A_DATE[$idx]}" "${A_ID[$idx]}" "${A_TITLE[$idx]}" >&2
    done
    return 2
  fi

  ((${#want} >= 4)) || usage_error "归档会话 id 前缀至少 4 位"
  for idx in "${!A_ID[@]}"; do
    [[ ${A_ID[$idx]} == "$want"* ]] && hits+=("$idx")
  done
  case ${#hits[@]} in
    0) usage_error "找不到归档会话 $want" ;;
    1) ARCHIVE_PICK=${hits[0]} ;;
    *)
      warn "归档会话前缀 $want 匹配到多个："
      for idx in "${hits[@]}"; do
        printf '  %s  %s  %s\n' "${A_DATE[$idx]}" "${A_ID[$idx]}" "${A_TITLE[$idx]}" >&2
      done
      return 2
      ;;
  esac
}

cmd_restore() {
  if ! archive_entries; then
    info '还没有归档'
    return 0
  fi
  local choice
  if ((${#ARGS[@]})); then
    find_archive_index "${ARGS[0]}" || return $?
  elif ui_available; then
    local -a items=()
    local idx
    for idx in "${!A_ID[@]}"; do
      items+=("$idx" "${A_DATE[$idx]}  ${A_TITLE[$idx]}  $(format_size "${A_SIZE[$idx]}")")
    done
    choice=$(ui_menu 'claudex / 归档' '选择要恢复的归档' "${items[@]}") || return "$EXIT_CANCEL"
    ARCHIVE_PICK=$choice
  else
    usage_error '恢复要指定归档会话 id，或先跑 claudex archives 查看'
  fi

  restore_entry "$ARCHIVE_PICK"
}

cmd_cache() {
  local id rc=0
  local -a ids=() picked=()
  if ((${#ARGS[@]})); then
    for id in "${ARGS[@]}"; do
      case "$id" in
        cache.snapshots|cache.orphans|cache.plugins|cache.history) ;;
        *) usage_error "未知缓存编号 $id" ;;
      esac
      if ! cache_available "$id"; then
        warn "缓存项 $id 在当前机器上不可用，跳过"
        continue
      fi
      picked+=("$id")
    done
  else
    cache_collect || die '没有可清理的缓存'
    for id in "${CACHE_AVAILABLE[@]}"; do
      ((CACHE_DEFAULT[$id])) && picked+=("$id")
    done
  fi
  ((${#picked[@]})) || die '没有可执行的缓存清理项'
  cache_run "${picked[@]}"
}

main() {
  parse_args "$@"
  detect_ui_mode
  need_cmd stat
  need_cmd du
  need_cmd find
  need_cmd grep
  need_cmd sed
  need_cmd awk
  need_cmd sort
  need_cmd date
  need_cmd mktemp
  need_cmd realpath
  need_cmd truncate

  if [[ -z $CMD ]]; then
    ((EXPLICIT_DRY)) || DRY_RUN=0
    ui_main
    return $?
  fi

  case "$CMD" in
    list) cmd_list ;;
    resume) cmd_resume ;;
    archive) cmd_archive ;;
    delete) cmd_delete ;;
    archives) cmd_archives ;;
    restore) cmd_restore ;;
    cache) cmd_cache ;;
    *) usage_error "未知命令 $CMD" ;;
  esac
}
