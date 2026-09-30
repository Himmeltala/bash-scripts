# 勾选界面与勾选记录：whiptail 复选清单、探不到终端时的编号输入、
# 同名标签去重、上次勾选的回填与保存。
# 取路径末尾 k 段。
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

# 同一份工作副本里可能共存好几个同名目标（比如各地域项目的 runnet-admin-service），
# 标签重了勾选界面就分不清，勾选记录也会互相覆盖。
# id 只要重名就得加尾巴，跟两条记录的尾巴是否相同无关：尾巴不同只说明取一段就够区分，
# 而不是不需要区分。尾巴不够用时再逐段加长。
assign_tags() {
  local -a recs=() ids=() displays=()
  local rec id workdir plpath mvnargs display cmdtext
  while IFS= read -r rec; do
    IFS=$FS read -r id workdir plpath mvnargs display cmdtext <<< "$rec"
    recs+=("$rec")
    ids+=("$id")
    displays+=("$display")
  done

  # 第一步：给每个重名的 id 求一个统一的尾巴段数，让这一组内两两可分。
  # 段数按组统一，免得同一批记录里有的加两段有的加三段，读起来乱。
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

whiptail_choose() {
  local -a recs=("$@") items=() picked=()
  local rec tag workdir plpath mvnargs display cmdtext

  # 上次勾过的预选中。勾选记录读进数组比对，别用 grep 逐条开进程。
  local -A selected=()
  if [[ -f $SEL_FILE ]]; then
    local line
    while IFS= read -r line; do
      [[ -n "$line" ]] && selected[$line]=1
    done < "$SEL_FILE"
  fi

  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    if [[ -n "${selected[$tag]:-}" ]]; then
      items+=("$tag" "$display" ON)
    else
      items+=("$tag" "$display" OFF)
    fi
  done

  local lines cols listh boxh
  lines=$(tput lines 2>/dev/null || printf '24')
  cols=$(tput cols 2>/dev/null || printf '100')
  ((cols < 60)) && cols=60
  listh=${#recs[@]}
  ((listh > lines - 8)) && listh=$((lines - 8))
  ((listh < 1)) && listh=1
  boxh=$((listh + 8))
  ((boxh > lines)) && boxh=$lines

  # 界面画在 stderr，勾选结果也写在 stderr（见 man whiptail 的 --checklist 一节），
  # 所以要用 3>&1 1>&2 2>&3 把两边调换，把结果捞进命令替换里。
  # 返回 1 表示取消，返回 2 表示确认了但一个都没勾。
  local out
  out=$(whiptail --separate-output --title 'mvnstart' --checklist \
    '空格勾选，回车确认；上次勾过的已经预先选中' \
    "$boxh" "$cols" "$listh" "${items[@]}" 3>&1 1>&2 2>&3) || return 1

  [[ -n "$out" ]] || return 2
  mapfile -t picked <<< "$out"

  local r p
  for r in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$r"
    for p in "${picked[@]}"; do
      [[ "$p" == "$tag" ]] && { printf '%s\n' "$r"; break; }
    done
  done
  # 循环最后一轮里内层 [[ ]] 判假会短路出状态 1，不显式返回 0 的话
  # 调用方会把成功当成取消。
  return 0
}

plain_choose() {
  local noun=$1
  shift
  local -a recs=("$@")
  local rec tag workdir plpath mvnargs display cmdtext i n
  printf '发现 %d 个%s:\n\n' "${#recs[@]}" "$noun" >&2
  for i in "${!recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "${recs[$i]}"
    printf '  %2d) %s\n      %s\n' "$((i + 1))" "$tag" "$display" >&2
  done
  printf '\n输入编号（如 1 3），回车后执行: ' >&2
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
