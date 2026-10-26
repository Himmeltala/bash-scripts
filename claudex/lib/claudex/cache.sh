# 缓存清理：旧快照与粘贴缓存、孤儿关联数据、插件缓存、历史与守护日志。

CACHE_DAYS=7
CACHE_IDS=(cache.snapshots cache.orphans cache.plugins cache.history)

declare -A CACHE_LABEL=(
  [cache.snapshots]='旧快照与粘贴缓存'
  [cache.orphans]='孤儿关联数据'
  [cache.plugins]='插件缓存'
  [cache.history]='历史与守护日志'
)
declare -A CACHE_DESC=(
  [cache.snapshots]='按修改时间清掉旧 shell 快照与粘贴缓存，天数在后面标明，不影响会话'
  [cache.orphans]='清掉找不到对应会话的 file-history、session-env 与会话目录，memory 不动'
  [cache.plugins]='清空 plugins/cache，下次启动时插件可能重新下载'
  [cache.history]='删除 history.jsonl 并把 daemon.log 清空，会丢输入历史'
)
declare -A CACHE_DEFAULT=(
  [cache.snapshots]=1
  [cache.orphans]=1
  [cache.plugins]=0
  [cache.history]=0
)

declare -A EXISTING_IDS=()
declare -a ORPHAN_PATHS=()

build_existing_ids() {
  local f id
  EXISTING_IDS=()
  while IFS= read -r f; do
    id=${f##*/}
    id=${id%.jsonl}
    EXISTING_IDS[$id]=1
  done < <(find "$SESSION_ROOT" -type f -name '*.jsonl' 2>/dev/null)
}

# 孤儿目录只认名字像会话 id 的目录；projects 下的 memory 永远跳过。
build_orphans() {
  local proj d base
  ORPHAN_PATHS=()
  build_existing_ids
  session_active_ids

  for d in "${CLAUDE_ROOT}"/file-history/*/ "${CLAUDE_ROOT}"/session-env/*/; do
    [[ -d $d ]] || continue
    d=${d%/}
    base=${d##*/}
    session_id_safe "$base" || continue
    [[ -n ${EXISTING_IDS[$base]:-} ]] && continue
    [[ -n ${ACTIVE_IDS[$base]:-} ]] && continue
    ORPHAN_PATHS+=("$d")
  done

  for proj in "${SESSION_ROOT}"/*/; do
    [[ -d $proj ]] || continue
    for d in "$proj"*/; do
      [[ -d $d ]] || continue
      d=${d%/}
      base=${d##*/}
      [[ $base == memory ]] && continue
      session_id_safe "$base" || continue
      [[ -f "${d%/*}/${base}.jsonl" ]] && continue
      [[ -n ${ACTIVE_IDS[$base]:-} ]] && continue
      ORPHAN_PATHS+=("$d")
    done
  done
}

old_file_size() {
  local days=$1 dir=$2 pattern=$3
  [[ -d $dir ]] || { printf '0\n'; return 0; }
  find "$dir" -maxdepth 1 -type f -name "$pattern" -mtime +"$days" -printf '%s\n' 2>/dev/null \
    | awk '{s += $1} END {print s + 0}'
}

cache_available() {
  case "$1" in
    cache.snapshots) [[ -d "${CLAUDE_ROOT}/shell-snapshots" || -d "${CLAUDE_ROOT}/paste-cache" ]] ;;
    cache.orphans) [[ -d "$SESSION_ROOT" ]] ;;
    cache.plugins) [[ -d "${CLAUDE_ROOT}/plugins/cache" ]] ;;
    cache.history) [[ -e "${CLAUDE_ROOT}/history.jsonl" || -e "${CLAUDE_ROOT}/daemon.log" ]] ;;
    *) return 1 ;;
  esac
}

cache_measure() {
  local id=$1 total=0 size p
  case "$id" in
    cache.snapshots)
      total=$(( $(old_file_size "$CACHE_DAYS" "${CLAUDE_ROOT}/shell-snapshots" 'snapshot-bash-*') \
              + $(old_file_size "$CACHE_DAYS" "${CLAUDE_ROOT}/paste-cache" '*') ))
      ;;
    cache.orphans)
      build_orphans
      for p in "${ORPHAN_PATHS[@]}"; do
        size=$(du -sb -- "$p" 2>/dev/null | awk '{print $1}')
        [[ -n $size ]] && total=$((total + size))
      done
      ;;
    cache.plugins)
      size=$(du -sb -- "${CLAUDE_ROOT}/plugins/cache" 2>/dev/null | awk '{print $1}')
      [[ -n $size ]] && total=$size
      ;;
    cache.history)
      for p in "${CLAUDE_ROOT}/history.jsonl" "${CLAUDE_ROOT}/daemon.log"; do
        size=$(stat -c %s -- "$p" 2>/dev/null) || continue
        total=$((total + size))
      done
      ;;
  esac
  printf '%s\n' "$total"
}

cache_clean() {
  local id=$1 p rc=0
  case "$id" in
    cache.snapshots)
      if [[ -d "${CLAUDE_ROOT}/shell-snapshots" ]]; then
        run_cmd find "${CLAUDE_ROOT}/shell-snapshots" -maxdepth 1 -type f -name 'snapshot-bash-*' \
          -mtime +"$CACHE_DAYS" -exec rm -f -- {} + || rc=1
      fi
      if [[ -d "${CLAUDE_ROOT}/paste-cache" ]]; then
        run_cmd find "${CLAUDE_ROOT}/paste-cache" -maxdepth 1 -type f \
          -mtime +"$CACHE_DAYS" -exec rm -f -- {} + || rc=1
      fi
      ;;
    cache.orphans)
      build_orphans
      for p in "${ORPHAN_PATHS[@]}"; do
        remove_path "$p" "$CLAUDE_REAL" || rc=1
      done
      ;;
    cache.plugins)
      if [[ -d "${CLAUDE_ROOT}/plugins/cache" ]]; then
        run_cmd find "${CLAUDE_ROOT}/plugins/cache" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + || rc=1
      fi
      ;;
    cache.history)
      if [[ -e "${CLAUDE_ROOT}/history.jsonl" ]]; then
        remove_path "${CLAUDE_ROOT}/history.jsonl" "$CLAUDE_REAL" || rc=1
      fi
      if [[ -e "${CLAUDE_ROOT}/daemon.log" ]]; then
        run_cmd truncate -s 0 -- "${CLAUDE_ROOT}/daemon.log" || rc=1
      fi
      ;;
  esac
  return "$rc"
}

cache_collect() {
  CACHE_AVAILABLE=()
  local id
  for id in "${CACHE_IDS[@]}"; do
    cache_available "$id" || continue
    CACHE_AVAILABLE+=("$id")
  done
  ((${#CACHE_AVAILABLE[@]}))
}

cache_run() {
  local id before after delta total=0 failed=0
  for id in "$@"; do
    before=$(cache_measure "$id" 2>/dev/null) || before=0
    info "清理：${CACHE_LABEL[$id]}"
    if ! cache_clean "$id"; then
      warn "${CACHE_LABEL[$id]} 未全部完成"
      failed=$((failed + 1))
      continue
    fi
    if ((DRY_RUN)); then
      delta=$before
    else
      after=$(cache_measure "$id" 2>/dev/null) || after=0
      delta=$((before - after))
      ((delta < 0)) && delta=0
    fi
    total=$((total + delta))
  done

  local label='释放'
  ((DRY_RUN)) && label='预计释放'
  printf 'claudex: 完成 %d 项，失败 %d 项，%s %s\n' \
    "$(($# - failed))" "$failed" "$label" "$(format_size "$total")" >&2
  ((failed == 0))
}
