# 动作层：归档、恢复归档、删除；所有移动与删除先过路径校验。

HOME_REAL=$(realpath -m -- "$HOME") || die "无法解析家目录 $HOME"
CLAUDE_REAL=$(realpath -m -- "$CLAUDE_ROOT") || die "无法解析 $CLAUDE_ROOT"
PROJECTS_REAL=$(realpath -m -- "$SESSION_ROOT") || die "无法解析 $SESSION_ROOT"
ARCHIVE_REAL=$(realpath -m -- "$ARCHIVE_ROOT") || die "无法解析归档目录 $ARCHIVE_ROOT"

declare -a A_DATE=()
declare -a A_ID=()
declare -a A_DIR=()
declare -a A_TITLE=()
declare -a A_SIZE=()

path_within() {
  local p=$1 root=$2
  [[ $root == / ]] && return 0
  [[ $p == "$root"/* ]]
}

validate_path() {
  local p=$1 root=$2 real
  [[ -n $p ]] || { warn '空路径，跳过'; return 1; }
  [[ $p == /* ]] || { warn "$p 不是绝对路径，跳过"; return 1; }
  case "$p" in
    *$'\n'*) warn '路径含换行，跳过'; return 1 ;;
    *'/../'*|*/..|../*) warn "$p 含 ..，跳过"; return 1 ;;
  esac
  real=$(realpath -m -- "$p") || { warn "无法解析 $p，跳过"; return 1; }
  [[ $real != "$root" ]] || { warn "拒绝删除根目录 $root"; return 1; }
  path_within "$real" "$root" || { warn "$real 不在 $root 之内，跳过"; return 1; }
  [[ -L $p ]] && { warn "$p 是符号链接，跳过"; return 1; }
  return 0
}

# 归档根允许放在家目录外，但不能是系统目录或别人的家目录。
validate_archive_root() {
  local root=$ARCHIVE_REAL
  [[ -n $root && $root != / && $root != "$HOME_REAL" ]] || die "归档目录不能用 $root"
  if path_within "$root" "$HOME_REAL"; then
    return 0
  fi
  case "$root" in
    /home|/home/*|/usr|/usr/*|/etc|/etc/*|/var|/var/*|/boot|/boot/*|\
    /proc|/proc/*|/sys|/sys/*|/dev|/dev/*|/run|/run/*|/opt|/opt/*|\
    /srv|/srv/*|/root|/root/*)
      die "归档目录 $root 落在系统目录里，换一个位置"
      ;;
  esac
  return 0
}

remove_path() {
  local p=$1 root=$2
  validate_path "$p" "$root" || return 1
  run_cmd rm -rf -- "$p"
}

archive_part_paths() {
  local idx=$1
  ARCHIVE_SRC=("${S_PATH[$idx]}")
  ARCHIVE_KIND=('session.jsonl')
  if [[ -n ${S_SDIR[$idx]} ]]; then
    ARCHIVE_SRC+=("${S_SDIR[$idx]}")
    ARCHIVE_KIND+=('session')
  fi
  if [[ -n ${S_HIST[$idx]} ]]; then
    ARCHIVE_SRC+=("${S_HIST[$idx]}")
    ARCHIVE_KIND+=('file-history')
  fi
  if [[ -n ${S_ENV[$idx]} ]]; then
    ARCHIVE_SRC+=("${S_ENV[$idx]}")
    ARCHIVE_KIND+=('session-env')
  fi
}

archive_one() {
  local idx=$1 id=${S_ID[$1]} dest date_dir
  local -a moved_src=() moved_dst=()
  local i src dst

  date_dir="${ARCHIVE_ROOT}/$(date +%F)"
  dest="${date_dir}/${id}"

  if [[ -L $date_dir || -L $dest ]]; then
    warn "归档路径是符号链接，拒绝写入：$dest"
    return 1
  fi
  if [[ -e $dest ]]; then
    warn "归档目标已存在：$dest"
    return 1
  fi
  if [[ -z ${S_CWD[$idx]} ]]; then
    warn "会话 $id 没有记录原路径，不能归档"
    return 1
  fi
  if [[ ${S_CWD[$idx]} == *$'\n'* ]]; then
    warn "会话 $id 的原路径含换行，无法写 meta"
    return 1
  fi

  archive_part_paths "$idx"
  for i in "${!ARCHIVE_SRC[@]}"; do
    validate_path "${ARCHIVE_SRC[$i]}" "$CLAUDE_REAL" || return 1
  done
  info "归档：${S_TITLE[$idx]}（$(format_size "${S_SIZE[$idx]}")）"

  if ((DRY_RUN)); then
    run_cmd mkdir -p -- "$dest"
    for i in "${!ARCHIVE_SRC[@]}"; do
      run_cmd mv -- "${ARCHIVE_SRC[$i]}" "${dest}/${ARCHIVE_KIND[$i]}"
    done
    return 0
  fi

  mkdir -p -- "$dest" || { warn "建目录失败：$dest"; return 1; }
  printf 'session_id=%s\nproject_dir=%s\ncwd=%s\n' \
    "$id" "${S_PROJECT[$idx]}" "${S_CWD[$idx]}" >"$dest/meta" || {
    warn "写 meta 失败：$dest"
    rm -rf -- "$dest"
    return 1
  }
  printf '%s\n' "${S_TITLE[$idx]}" >"$dest/title"

  for i in "${!ARCHIVE_SRC[@]}"; do
    src=${ARCHIVE_SRC[$i]}
    dst="${dest}/${ARCHIVE_KIND[$i]}"
    if ! mv -- "$src" "$dst"; then
      warn "移动失败：$src"
      local j
      for ((j = ${#moved_src[@]} - 1; j >= 0; j--)); do
        mv -- "${moved_dst[$j]}" "${moved_src[$j]}" 2>/dev/null
      done
      rm -rf -- "$dest"
      return 1
    fi
    moved_src+=("$src")
    moved_dst+=("$dst")
  done
  return 0
}

archive_sessions() {
  local id idx rc=0
  validate_archive_root
  for id in "$@"; do
    if ! session_index_of "$id"; then
      warn "找不到会话 $id"
      rc=1
      continue
    fi
    idx=$S_CUR
    if session_is_active "$id"; then
      warn "会话 $id 正在运行，跳过归档"
      rc=1
      continue
    fi
    archive_one "$idx" || rc=1
  done
  return "$rc"
}

meta_get() {
  local dir=$1 key=$2
  [[ -f "$dir/meta" ]] || return 1
  grep -m1 "^${key}=" "$dir/meta" 2>/dev/null | cut -d= -f2-
}

archive_entries() {
  local entry dir date id size title
  local -a rows=()

  A_DATE=(); A_ID=(); A_DIR=(); A_TITLE=(); A_SIZE=()
  [[ -d $ARCHIVE_ROOT ]] || return 1

  for entry in "${ARCHIVE_ROOT}"/*/*/; do
    [[ -d $entry ]] || continue
    dir=${entry%/}
    [[ -f "$dir/session.jsonl" ]] || continue
    date=${dir%/*}
    date=${date##*/}
    id=${dir##*/}
    session_id_safe "$id" || continue
    title=''
    [[ -f "$dir/title" ]] && title=$(head -n1 -- "$dir/title")
    [[ -n $title ]] || title=${id:0:8}
    size=$(du -sb -- "$dir" 2>/dev/null | awk '{print $1}')
    [[ -n $size ]] || size=0
    rows+=("${date}"$'\t'"${id}"$'\t'"${size}"$'\t'"${dir}")
  done

  if ((${#rows[@]} == 0)); then
    return 1
  fi

  while IFS=$'\t' read -r date id size dir; do
    A_DATE+=("$date")
    A_ID+=("$id")
    A_DIR+=("$dir")
    A_SIZE+=("$size")
    title=''
    [[ -f "$dir/title" ]] && title=$(head -n1 -- "$dir/title")
    A_TITLE+=("${title:-${id:0:8}}")
  done < <(printf '%s\n' "${rows[@]}" | sort -r)
  return 0
}

restore_entry() {
  local idx=$1 dir=${A_DIR[$1]} id=${A_ID[$1]}
  local proj cwd target_json target_sdir target_hist target_env date_dir
  local -a srcs=() dsts=()
  local i

  if [[ ! -d $dir ]]; then
    warn "归档目录不存在：$dir"
    return 1
  fi
  proj=$(meta_get "$dir" project_dir) || proj=''
  cwd=$(meta_get "$dir" cwd) || cwd=''
  if [[ -z $proj || -z $cwd ]]; then
    warn "归档 $id 缺少 meta 或 cwd，无法恢复"
    return 1
  fi
  case "$proj" in
    ''|.|..|*/*|*$'\n'*) warn "归档 $id 的项目目录名不合法：$proj"; return 1 ;;
  esac

  target_json="${SESSION_ROOT}/${proj}/${id}.jsonl"
  target_sdir="${SESSION_ROOT}/${proj}/${id}"
  target_hist="${CLAUDE_ROOT}/file-history/${id}"
  target_env="${CLAUDE_ROOT}/session-env/${id}"
  date_dir=$(dirname -- "$dir")

  for i in "$target_json" "$target_sdir" "$target_hist" "$target_env"; do
    if [[ -e $i ]]; then
      warn "目标已存在，拒绝恢复：$i"
      return 1
    fi
  done

  srcs=("$dir/session.jsonl")
  dsts=("$target_json")
  [[ -d "$dir/session" ]] && { srcs+=("$dir/session"); dsts+=("$target_sdir"); }
  [[ -d "$dir/file-history" ]] && { srcs+=("$dir/file-history"); dsts+=("$target_hist"); }
  [[ -d "$dir/session-env" ]] && { srcs+=("$dir/session-env"); dsts+=("$target_env"); }

  for i in "${!srcs[@]}"; do
    validate_path "${srcs[$i]}" "$ARCHIVE_REAL" || return 1
    validate_path "${dsts[$i]}" "$CLAUDE_REAL" || return 1
  done

  info "恢复：${A_TITLE[$idx]}（$(format_size "${A_SIZE[$idx]}")）"

  if ((DRY_RUN)); then
    run_cmd mkdir -p -- "${SESSION_ROOT}/${proj}"
    for i in "${!srcs[@]}"; do
      run_cmd mv -- "${srcs[$i]}" "${dsts[$i]}"
    done
    run_cmd rm -rf -- "$dir"
    return 0
  fi

  mkdir -p -- "${SESSION_ROOT}/${proj}" || { warn "建项目目录失败"; return 1; }
  local -a moved_src=() moved_dst=()
  for i in "${!srcs[@]}"; do
    if ! mv -- "${srcs[$i]}" "${dsts[$i]}"; then
      warn "恢复失败：${srcs[$i]}"
      local j
      for ((j = ${#moved_src[@]} - 1; j >= 0; j--)); do
        mv -- "${moved_dst[$j]}" "${moved_src[$j]}" 2>/dev/null
      done
      return 1
    fi
    moved_src+=("${srcs[$i]}")
    moved_dst+=("${dsts[$i]}")
  done

  validate_path "$dir" "$ARCHIVE_REAL" || return 1
  rm -rf -- "$dir"
  rmdir -- "$date_dir" 2>/dev/null || true
  return 0
}

# 继续会话：切到原目录后 exec，成功时不返回。
resume_session() {
  local id=$1 idx cwd
  if ! session_index_of "$id"; then
    warn "找不到会话 $id"
    return 1
  fi
  idx=$S_CUR
  if session_is_active "$id"; then
    warn "会话 $id 正在运行，不能重复继续"
    return 1
  fi
  cwd=${S_CWD[$idx]}
  if [[ -z $cwd || ! -d $cwd ]]; then
    warn "会话 $id 的原目录不存在：${cwd:-空}"
    return 1
  fi
  command -v claude >/dev/null 2>&1 || { warn '找不到 claude 命令'; return 1; }

  info "切换到 $cwd，继续会话 $id"
  cd -- "$cwd" || { warn "切换目录失败：$cwd"; return 1; }
  exec claude --resume "$id"
}

delete_sessions() {
  local id idx rc=0 part
  for id in "$@"; do
    if ! session_index_of "$id"; then
      warn "找不到会话 $id"
      rc=1
      continue
    fi
    idx=$S_CUR
    if session_is_active "$id"; then
      warn "会话 $id 正在运行，跳过删除"
      rc=1
      continue
    fi
    info "删除：${S_TITLE[$idx]}（$(format_size "${S_SIZE[$idx]}")）"
    for part in "${S_PATH[$idx]}" "${S_SDIR[$idx]}" "${S_HIST[$idx]}" "${S_ENV[$idx]}"; do
      [[ -n $part && -e $part ]] || continue
      remove_path "$part" "$CLAUDE_REAL" || rc=1
    done
  done
  return "$rc"
}
