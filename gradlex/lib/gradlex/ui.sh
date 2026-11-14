# 勾选界面与勾选记录：记录映射、同名标签去重、上次勾选回填。
# 界面自绘由 bash-tui 提供；复选输出到 stdout，取消返回 1、没勾返回 2、上一步返回 4。

# 同一工作副本里可能有同名目标，标签重了界面分不清，勾选记录也会互相覆盖。
# 去重交给 ui_unique_tags：重名时按展示路径的尾巴加长，直到组内两两可分。
assign_tags() {
  local -a recs=() ids=() displays=() pairs=() tags=()
  local rec id workdir projectpath taskargs display cmdtext i
  while IFS= read -r rec; do
    IFS=$FS read -r id workdir projectpath taskargs display cmdtext <<< "$rec"
    recs+=("$rec")
    ids+=("$id")
    displays+=("$display")
  done

  ((${#recs[@]})) || return 0

  for i in "${!recs[@]}"; do
    pairs+=("${ids[$i]}" "${displays[$i]}")
  done
  mapfile -t tags < <(ui_unique_tags "${pairs[@]}")

  for i in "${!recs[@]}"; do
    IFS=$FS read -r id workdir projectpath taskargs display cmdtext <<< "${recs[$i]}"
    emit_record "${tags[$i]}" "$workdir" "${projectpath}" "${taskargs}" "$display" "$cmdtext"
  done
  return 0
}

# 复选：把六列记录映射成通用层的「标签、说明、状态」三元组，再把选中标签映射回记录。
gradlex_ui_checklist() {
  _gradlex_checklist ui_checklist "$@"
}

_gradlex_checklist() {
  local picker=$1 noun=$2
  shift 2
  local -a recs=("$@") items=() picked=()
  local rec tag workdir projectpath taskargs display cmdtext out rc=0 p

  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
    items+=("$tag" "${display}"$'\t'"${cmdtext}" OFF)
  done

  ui_preselect_load "${SEL_FILE:-}"
  out=$("$picker" "gradlex · $noun" '' "${items[@]}") || rc=$?
  ((rc == 0)) || return "$rc"

  mapfile -t picked <<< "$out"
  for p in "${picked[@]}"; do
    for rec in "${recs[@]}"; do
      IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
      [[ "$p" == "$tag" ]] && { printf '%s\n' "$rec"; break; }
    done
  done
  return 0
}

save_selection() {
  local -a recs=("$@") tags=()
  local rec tag workdir projectpath taskargs display cmdtext
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
    tags+=("$tag")
  done
  [[ -n ${SEL_FILE:-} ]] || return 0
  ui_preselect_save "$SEL_FILE" "${tags[@]+"${tags[@]}"}"
}

SEL_FILE=''
