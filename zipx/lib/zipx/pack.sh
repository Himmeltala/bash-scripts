# 压缩：把当前目录下的条目打成 zip。

# 当前目录下的条目名，目录带尾斜杠，只为在界面上区分目录与文件；不用 ls 以免空格打乱列，glob 加 -d 足够。
list_dir_entries() {
  local e
  shopt -s nullglob dotglob
  for e in *; do
    if [[ -d "$e" ]]; then
      printf '%s/\n' "$e"
    else
      printf '%s\n' "$e"
    fi
  done
  shopt -u nullglob dotglob
}

# 默认不排除任何条目；只有命令行上 --exclude 给的模式才传给 zip，按 zip 的规则匹配归档内路径。
build_exclude_patterns() {
  local -n out=$1
  local x
  for x in "${USER_EXCLUDES[@]}"; do
    [[ -n "$x" ]] && out+=(-x "$x")
  done
  return 0
}

# 勾选要打包的条目。当前目录下没有东西可选时返回 1。
ui_pick_entries() {
  local -a items=()
  local e name
  while IFS= read -r e; do
    name="${e%/}"
    reject_odd_name "$name"
    if [[ "$e" == */ ]]; then
      ui_item_text "$name" '目录'
    else
      ui_item_text "$name" '文件'
    fi
    items+=("$name" "$UI_ITEM_TEXT" OFF)
  done < <(list_dir_entries)

  ((${#items[@]})) || { info '当前目录下没有可打包的条目'; return 1; }
  ui_checklist_optional 'zipx 压缩' '空格勾选，回车确认' "${items[@]}"
}

cmd_pack() {
  local -a entries=("$@")
  local out e

  if ((${#entries[@]} == 0)); then
    out=$(ui_pick_entries) || return "$EXIT_CANCEL"
    [[ -n "$out" ]] || die '一个条目都没勾'
    mapfile -t entries <<< "$out"
  fi

  for e in "${entries[@]}"; do
    reject_odd_name "$e"
  done

  # 后缀统一在下面补，默认值不再带 .zip，界面里看到的与最终包名一致。
  out="${PACK_OUT:-}"
  [[ -n "$out" ]] || out="$(basename "$PWD")"
  [[ "$out" == *.zip ]] || out+='.zip'

  # 已有的包不静默覆盖：包里可能是上一次打包的内容，覆盖后无法恢复。
  if [[ -e "$out" ]]; then
    ((OVERWRITE)) || die "「$out」已存在，加 --overwrite 或 -o 换名"
  fi

  local -a cmd=(zip -r "$(archive_arg "$out")")
  cmd+=("${entries[@]}")
  build_exclude_patterns cmd

  run_cmd "${cmd[@]}" || die '打包失败，看上面的 zip 输出'
  # 预演模式没有真正执行，包文件当然不存在，这一句只能放在预演之后。
  ((DRY_RUN)) && return 0
  [[ -e "$out" ]] || die '打包失败，zip 没有生成包文件'
  info "已生成 $out"
}

# 界面流程：勾条目、定包名，再交给 cmd_pack。
ui_pack() {
  local out
  out=$(ui_pick_entries) || return "$EXIT_CANCEL"
  [[ -n "$out" ]] || { info '一个条目都没勾'; return 0; }
  mapfile -t UI_ENTRIES <<< "$out"

  out=$(ui_input 'zipx 压缩' '输出包名（自动补 .zip）' "$(basename "$PWD")") || return "$EXIT_CANCEL"
  PACK_OUT=$out

  cmd_pack "${UI_ENTRIES[@]}"
}
