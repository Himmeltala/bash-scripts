# 执行器：路径安全校验、逐项清理与结果统计。

HOME_REAL=$(realpath -m -- "$HOME") || die "无法解析家目录 $HOME"

path_within_home() {
  [[ $HOME_REAL == / ]] && return 0
  [[ $1 == "$HOME_REAL"/* ]]
}

RESULT_DONE=0
RESULT_FAIL=0
RESULT_SKIP=0
RESULT_FREED=0
RESULT_UNKNOWN=0

# 路径项只允许动家目录以内的东西；解析后仍在家目录外的一律拒绝。
validate_path() {
  local p=$1 real
  [[ -n $p ]] || { warn '空路径，跳过'; return 1; }
  [[ $p == /* ]] || { warn "$p 不是绝对路径，跳过"; return 1; }
  case "$p" in
    *$'\n'*) warn '路径含换行，跳过'; return 1 ;;
    *'/../'*|*/..|../*) warn "$p 含 ..，跳过"; return 1 ;;
  esac
  [[ $p != "$HOME_REAL" && $p != / ]] || { warn "拒绝删除 $p"; return 1; }
  real=$(realpath -m -- "$p") || { warn "无法解析 $p，跳过"; return 1; }
  path_within_home "$real" || { warn "$real 不在家目录内，跳过"; return 1; }
  [[ -L $p ]] && { warn "$p 是符号链接，跳过"; return 1; }
  return 0
}

is_mountpoint() {
  command -v mountpoint >/dev/null 2>&1 && mountpoint -q -- "$1" 2>/dev/null
}

# 家目录里的缓存目录可能是独立挂载点，这时只清内容，不删挂载点本身。
remove_path() {
  local p=$1 as_root=${2:-0}
  validate_path "$p" || return 1

  if [[ -d $p ]] && is_mountpoint "$p"; then
    if ((as_root)); then
      run_root_cmd find "$p" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    else
      run_cmd find "$p" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    fi
  else
    if ((as_root)); then
      run_root_cmd rm -rf -- "$p"
    else
      run_cmd rm -rf -- "$p"
    fi
  fi
}

clean_path_item() {
  local id=$1 data=${ITEM_DATA[$1]} root=${ITEM_ROOT[$1]} line rc=0 any=0
  while IFS= read -r line; do
    [[ -n $line && -e $line ]] || continue
    any=1
    info "  $line"
    remove_path "$line" "$root" || rc=1
  done <<<"$data"
  if ((!any)); then
    warn "${ITEM_LABEL[$id]} 的路径都不存在"
    return 1
  fi
  return "$rc"
}

# root 项逐项确认；预览模式与 --yes 都不问，非交互环境没有 --yes 时直接跳过。
confirm_root() {
  local id=$1
  ((DRY_RUN || ASSUME_YES)) && return 0
  if [[ ! -t 0 ]]; then
    warn "非交互环境不确认 root 项，跳过 ${ITEM_LABEL[$id]}"
    return 1
  fi
  ui_yesno '需要 root' "执行「${ITEM_LABEL[$id]}」？这一步会用 sudo。"
}

execute_item() {
  local id=$1 label=${ITEM_LABEL[$1]} kind=${ITEM_KIND[$1]} root=${ITEM_ROOT[$1]}
  local before='' after='' delta=0 rc=0

  if ((root)) && ! command -v sudo >/dev/null 2>&1; then
    warn "找不到 sudo，跳过 $label"
    RESULT_SKIP=$((RESULT_SKIP + 1))
    return 0
  fi
  if ((root)) && ! confirm_root "$id"; then
    RESULT_SKIP=$((RESULT_SKIP + 1))
    return 0
  fi

  before=$(item_size "$id" 2>/dev/null) || before=''
  info "清理：$label"

  case "$kind" in
    path) clean_path_item "$id" || rc=1 ;;
    func) "${ITEM_DATA[$id]}" || rc=1 ;;
    *) rc=1 ;;
  esac

  if ((rc != 0)); then
    warn "$label 未全部完成"
    RESULT_FAIL=$((RESULT_FAIL + 1))
    return 1
  fi

  if ((DRY_RUN)); then
    if [[ -n $before ]]; then
      RESULT_FREED=$((RESULT_FREED + before))
    else
      RESULT_UNKNOWN=$((RESULT_UNKNOWN + 1))
    fi
  else
    after=$(item_size "$id" 2>/dev/null) || after=''
    if [[ -n $before && -n $after ]]; then
      delta=$((before - after))
      ((delta < 0)) && delta=0
      RESULT_FREED=$((RESULT_FREED + delta))
    else
      RESULT_UNKNOWN=$((RESULT_UNKNOWN + 1))
    fi
  fi

  RESULT_DONE=$((RESULT_DONE + 1))
  return 0
}

print_summary() {
  local label='释放'
  ((DRY_RUN)) && label='预计释放'
  printf 'cleanx: 完成 %d 项，失败 %d 项，跳过 %d 项，%s %s' \
    "$RESULT_DONE" "$RESULT_FAIL" "$RESULT_SKIP" "$label" "$(format_size "$RESULT_FREED")" >&2
  ((RESULT_UNKNOWN > 0)) && printf '，另有 %d 项大小未知' "$RESULT_UNKNOWN" >&2
  printf '\n' >&2
}

# 传进来的是清理项编号；返回 1 表示至少有一项没完成。
run_selection() {
  local id rc=0
  RESULT_DONE=0
  RESULT_FAIL=0
  RESULT_SKIP=0
  RESULT_FREED=0
  RESULT_UNKNOWN=0

  for id in "$@"; do
    execute_item "$id" || rc=1
  done
  print_summary
  return "$rc"
}

# 命令行执行前先把选中项与大小列一遍，--yes 时删除前也有据可查。
show_selection() {
  local id size
  for id in "$@"; do
    size=$(item_size "$id" 2>/dev/null) || size=''
    if [[ -n $size ]]; then
      printf '  %-16s %-10s %s\n' "$id" "$(format_size "$size")" "${ITEM_LABEL[$id]}" >&2
    else
      printf '  %-16s %-10s %s\n' "$id" '未知' "${ITEM_LABEL[$id]}" >&2
    fi
  done
}
