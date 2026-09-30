# 压缩：把当前目录下的条目打成 zip。

# 当前目录下的条目名，目录带尾斜杠，只为在界面上区分目录与文件。
# 不用 ls 取名字：文件名里的空格会把列排乱，glob 加 -d 判断就够。
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

# 排除规则匹配的是归档内路径，所以要带上被选中条目这一层前缀：
# 选中 proj 时，proj/.git 以及它下面的所有东西都要排掉。
# 用户显式选中的条目本身不排除，选 .git 就是要它。
# 条目写成 "." 或 "./x" 时，zip 存进去的路径可能不带前导 "./"，两种写法都补上。
build_exclude_patterns() {
  local -n out=$1
  shift
  local -a picked=("$@")
  local x e bare
  if ((NO_EXCLUDE == 0)); then
    for x in "${DEFAULT_EXCLUDES[@]}"; do
      for e in "${picked[@]}"; do
        e="${e%/}"
        [[ "$e" == "$x" || "$e" == "./$x" ]] && continue
        if [[ "$e" == '.' ]]; then
          out+=(-x "$x" -x "$x/*")
          continue
        fi
        out+=(-x "$e/$x" -x "$e/$x/*")
        bare="${e#./}"
        [[ "$bare" != "$e" ]] && out+=(-x "$bare/$x" -x "$bare/$x/*")
      done
    done
  fi
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
      items+=("$name" '目录' OFF)
    else
      items+=("$name" '文件' OFF)
    fi
  done < <(list_dir_entries)

  ((${#items[@]})) || { info '当前目录下没有可打包的条目'; return 1; }
  ui_checklist 'zipx 压缩' '空格勾选要打包的条目，回车确认' "${items[@]}"
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

  out="${PACK_OUT:-}"
  [[ -n "$out" ]] || out="$(basename "$PWD").zip"
  [[ "$out" == *.zip ]] || out+='.zip'

  # 已有的包不静默覆盖：包里可能是上一次打包的东西，覆盖掉找不回来。
  if [[ -e "$out" ]]; then
    ((OVERWRITE)) || die "「$out」已存在，要覆盖就加 --overwrite，或者用 -o 换个包名"
  fi

  local -a cmd=(zip -r "$(archive_arg "$out")")
  # 加密只用 -e，让 zip 自己提示输入密码。不用 -P：那个密码会留在进程列表里，
  # 同一台机器上 ps 就能看见。
  ((ENCRYPT)) && cmd+=(-e)
  cmd+=("${entries[@]}")
  build_exclude_patterns cmd "${entries[@]}"

  run_cmd "${cmd[@]}" || die '打包失败，看上面的 zip 输出'
  # 预演模式没有真跑，包文件当然不存在，这一句只能放在预演之后。
  ((DRY_RUN)) && return 0
  [[ -e "$out" ]] || die '打包失败，zip 没有生成包文件'
  info "已生成 $out"
}

# 界面流程：勾条目、定包名、问加密，再交给 cmd_pack。
ui_pack() {
  local out
  out=$(ui_pick_entries) || return "$EXIT_CANCEL"
  [[ -n "$out" ]] || { info '一个条目都没勾'; return 0; }
  mapfile -t UI_ENTRIES <<< "$out"

  out=$(ui_input 'zipx 压缩' '输出包名' "$(basename "$PWD").zip") || return "$EXIT_CANCEL"
  PACK_OUT=$out

  if ui_yesno 'zipx 压缩' '要加密吗？选是则由 zip 交互提示输入两次密码'; then
    ENCRYPT=1
  fi

  cmd_pack "${UI_ENTRIES[@]}"
}
