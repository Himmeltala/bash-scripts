# 勾选界面与勾选记录：单选菜单、目标复选、「全部」联动、无终端时的编号输入、同名标签去重、上次勾选回填。
# 界面自绘是因为 whiptail 只在确认时返回结果，做不到「全部」与各项实时联动；复选输出到 stdout，取消返回 1、没勾返回 2、上一步返回 4。
tail_segments() {
  local -a parts=()
  IFS='/' read -r -a parts <<< "$1"
  local n=${#parts[@]} k=$2
  ((k > n)) && k=$n
  local i out=''
  for ((i = n - k; i < n; i++)); do
    out+="${out:+/}${parts[$i]}"
  done
  printf '%s\n' "$out"
}

# 同一工作副本里可能有同名目标，标签重了界面分不清，勾选记录也会互相覆盖。
# 同一 id 只要重名就加路径尾巴；尾巴跟 id 一字不差等于没加，仍须加长；尾巴不够用时逐段加长。
assign_tags() {
  local -a recs=() ids=() displays=()
  local rec id workdir plpath mvnargs display cmdtext
  while IFS= read -r rec; do
    IFS=$FS read -r id workdir plpath mvnargs display cmdtext <<< "$rec"
    recs+=("$rec")
    ids+=("$id")
    displays+=("$display")
  done

  # 第一步：给每个重名 id 求统一的尾巴段数，让组内两两可分；段数按组统一，免得同批记录有的两段有的三段。
  # 记 0 表示这个 id 没重名，原样使用。
  local -A tail_k=()
  local i j k ok dup tail
  for i in "${!recs[@]}"; do
    [[ -n "${tail_k[${ids[$i]}]:-}" ]] && continue

    dup=0
    for j in "${!recs[@]}"; do
      [[ $j -eq $i ]] && continue
      [[ "${ids[$j]}" == "${ids[$i]}" ]] && { dup=1; break; }
    done
    if ((dup == 0)); then
      tail_k["${ids[$i]}"]=0
      continue
    fi

    local -A seen=()
    for ((k = 1; k <= 20; k++)); do
      seen=()
      ok=1
      for j in "${!recs[@]}"; do
        [[ "${ids[$j]}" == "${ids[$i]}" ]] || continue
        tail=$(tail_segments "${displays[$j]}" "$k")
        # 尾巴跟 id 一字不差等于没加；同一组里两段尾巴撞了也不行
        if [[ "$tail" == "${ids[$i]}" || -n "${seen[$tail]:-}" ]]; then
          ok=0
          break
        fi
        seen[$tail]=1
      done
      ((ok == 1)) && break
    done
    tail_k["${ids[$i]}"]=$k
  done

  local -a tags=()
  local candidate
  for i in "${!recs[@]}"; do
    k=${tail_k[${ids[$i]}]}
    if ((k == 0)); then
      tags+=("${ids[$i]}")
      continue
    fi

    candidate="${ids[$i]}@$(tail_segments "${displays[$i]}" "$k")"
    # 段数取满仍分不开的极端情况，补一段展示路径的哈希兜底
    for j in "${!tags[@]}"; do
      [[ "${tags[$j]}" == "$candidate" ]] || continue
      candidate="${candidate}#$(printf '%s' "${displays[$i]}" | md5sum | cut -c1-4)"
      break
    done
    tags+=("$candidate")
  done

  for i in "${!recs[@]}"; do
    IFS=$FS read -r id workdir plpath mvnargs display cmdtext <<< "${recs[$i]}"
    emit_record "${tags[$i]}" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
  done
  return 0
}

# 单选菜单。$1 标题，$2 提示，其余为标签与说明，成对给出。
ui_menu() {
  local title=$1 prompt=$2
  shift 2
  if ! ui_available; then
    plain_menu "$prompt" "$@"
    return $?
  fi
  tui_select menu "$title" "$prompt" "$@"
}

# 目标复选。$1 是目标的名词，只用在编号输入的提示语里；其余为记录。
ui_checklist() {
  local noun=$1
  shift
  local -a recs=("$@") items=() picked=()
  local rec tag workdir plpath mvnargs display cmdtext out rc=0 p

  if ! ui_available; then
    plain_checklist "$noun" "${recs[@]}"
    return $?
  fi

  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    items+=("$tag" "$display")
  done

  out=$(tui_select checklist "mvnx · $noun" '' "${items[@]}") || rc=$?
  ((rc == 0)) || return "$rc"

  mapfile -t picked <<< "$out"
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    for p in "${picked[@]}"; do
      [[ "$p" == "$tag" ]] && { printf '%s\n' "$rec"; break; }
    done
  done
  return 0
}

# 带「全部」总开关的复选，总开关与其余项实时联动。参数与输出同 ui_checklist。
ui_checklist_all() {
  local noun=$1
  shift
  local -a recs=("$@") items=() picked=()
  local rec tag workdir plpath mvnargs display cmdtext out rc=0 p

  if ! ui_available; then
    plain_checklist "$noun" "${recs[@]}"
    return $?
  fi

  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    items+=("$tag" "$display")
  done

  out=$(tui_select all "mvnx · $noun" '' "${items[@]}") || rc=$?
  ((rc == 0)) || return "$rc"

  mapfile -t picked <<< "$out"
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    for p in "${picked[@]}"; do
      [[ "$p" == "$tag" ]] && { printf '%s\n' "$rec"; break; }
    done
  done
  return 0
}

# 没有终端时的编号单选。
plain_menu() {
  local prompt=$1
  shift
  local -a tags=() descs=()
  while (($# > 1)); do
    tags+=("$1")
    descs+=("$2")
    shift 2
  done

  printf '%s\n\n' "$prompt" >&2
  local i
  for i in "${!tags[@]}"; do
    printf '  %2d) %-14s %s\n' "$((i + 1))" "${tags[$i]}" "${descs[$i]}" >&2
  done
  printf '\n编号（回车取消）: ' >&2

  local answer
  read -r answer || return 1
  [[ "$answer" =~ ^[0-9]+$ ]] || return 1
  ((answer >= 1 && answer <= ${#tags[@]})) || return 1
  printf '%s\n' "${tags[$((answer - 1))]}"
}

plain_checklist() {
  local noun=$1
  shift
  local -a recs=("$@")
  local rec tag workdir plpath mvnargs display cmdtext i n
  printf '%d 个%s:\n\n' "${#recs[@]}" "$noun" >&2
  for i in "${!recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "${recs[$i]}"
    printf '  %2d) %s\n      %s\n' "$((i + 1))" "$tag" "$display" >&2
  done
  printf '\n编号，空格分隔: ' >&2
  local answer
  read -r answer || return 1
  [[ -n "$answer" ]] || return 2

  local -a picked=()
  for n in $answer; do
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    ((n >= 1 && n <= ${#recs[@]})) || continue
    picked+=("${recs[$((n - 1))]}")
  done
  [[ ${#picked[@]} -gt 0 ]] || return 2
  printf '%s\n' "${picked[@]}"
  return 0
}

save_selection() {
  local -a recs=("$@")
  mkdir -p "$CACHE_DIR"
  : > "$SEL_FILE"
  local rec tag workdir plpath mvnargs display cmdtext
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    printf '%s\n' "$tag" >> "$SEL_FILE"
  done
}

SEL_FILE=''
