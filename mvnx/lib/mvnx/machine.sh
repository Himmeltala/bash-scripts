# 机器接口：--list --json 供 jvmx 网页壳读目标，exec --id 执行单个目标。
# 目标记录仍是六段：标签|工作目录|-pl 路径|mvn 参数|展示路径|展示命令。
# id 取「命令:标签」；标签在一次收集里唯一，跨次稳定，网页拿它回传即可。

json_escape() {
  local text=$1
  text=${text//\\/\\\\}
  text=${text//\"/\\\"}
  text=${text//$'\n'/\\n}
  text=${text//$'\r'/\\r}
  text=${text//$'\t'/\\t}
  printf '%s' "$text"
}

# 一条命令的可执行目标。install 与终端一致，展开成各项目下可选装的子模块。
machine_collect() {
  local cmd=$1 rec tag workdir
  if [[ "$cmd" == "$INSTALL_COMMAND" ]]; then
    local -a subs
    while IFS= read -r rec; do
      IFS=$FS read -r tag workdir _ _ _ _ <<< "$rec"
      mapfile -t subs < <(emit_project_modules "$workdir" "$tag")
      ((${#subs[@]})) || subs=("$rec")
      printf '%s\n' "${subs[@]}"
    done < <(collect_toplevel | shell_assign_tags)
    return 0
  fi
  "$(command_field "$cmd" 3)" | shell_assign_tags
}

machine_json() {
  local cmd=$1 first=1 rec tag workdir plpath args display cmdtext
  printf '{"command":"%s","root":"%s","targets":[' \
    "$(json_escape "$cmd")" "$(json_escape "$PWD")"
  while IFS= read -r rec; do
    [[ -n "$rec" ]] || continue
    IFS=$FS read -r tag workdir plpath args display cmdtext <<< "$rec"
    ((first)) || printf ','
    first=0
    printf '{"id":"%s","command":"%s","tag":"%s","path":"%s","cwd":"%s","display":"%s"}' \
      "$(json_escape "$cmd:$tag")" "$(json_escape "$cmd")" "$(json_escape "$tag")" \
      "$(json_escape "$plpath")" "$(json_escape "$workdir")" "$(json_escape "$cmdtext")"
  done < <(machine_collect "$cmd")
  printf ']}\n'
}

# 网页传来的每行参数追加到 mvn 参数尾部，展示命令同步重拼。
apply_extra_args() {
  local rec tag workdir plpath args display cmdtext
  while IFS= read -r rec; do
    IFS=$FS read -r tag workdir plpath args display cmdtext <<< "$rec"
    if [[ -n "$EXTRA_ARGS" ]]; then
      args="${args:+$args }$EXTRA_ARGS"
      cmdtext='mvn'
      [[ -n "$plpath" ]] && cmdtext+=" -pl $plpath"
      cmdtext+=" $args"
    fi
    emit_record "$tag" "$workdir" "$plpath" "$args" "$display" "$cmdtext"
  done
}

machine_exec() {
  local id=$EXEC_ID
  [[ -n "$id" ]] || usage_error 'exec 需要 --id'
  command -v mvn >/dev/null || die '找不到 mvn，确认 Maven 在 PATH 中'

  local cmd=${id%%:*}
  command_exists "$cmd" || usage_error "未知目标 $id"

  local allow_skip
  allow_skip=$(command_field "$cmd" 5)
  if [[ $allow_skip -eq 0 && $START_MODE != "$MODE_AUTO" && $START_MODE != "$MODE_COMPILE" ]]; then
    usage_error "「$cmd」命令不支持 $MODE_FLAG"
  fi
  if [[ -n "$NO_AM_FLAG" && "$cmd" != "$PACKAGE_COMMAND" && "$cmd" != "$INSTALL_COMMAND" ]]; then
    usage_error "「$cmd」命令不支持 $NO_AM_FLAG"
  fi
  if [[ -n "$PACK_NO_CLEAN_FLAG" && "$cmd" != "$PACKAGE_COMMAND" ]]; then
    usage_error "「$cmd」命令不支持 $PACK_NO_CLEAN_FLAG"
  fi

  prepare_scan "$PWD"
  local rec match='' tag workdir plpath
  while IFS= read -r rec; do
    IFS=$FS read -r tag workdir plpath _ _ _ <<< "$rec"
    if [[ "$cmd:$tag" == "$id" ]]; then
      match=$rec
      break
    fi
  done < <(machine_collect "$cmd")
  [[ -n "$match" ]] || die "没有目标 $id" "$EXIT_USAGE"

  if [[ $START_MODE == "$MODE_NO_COMPILE" ]]; then
    local dir=$workdir
    [[ -n "$plpath" ]] && dir="$workdir/$plpath"
    [[ -d "$dir/target/classes" ]] ||
      die "「$id」没有 target/classes，先编译或去掉 $MODE_FLAG" "$EXIT_USAGE"
  fi

  match=$(printf '%s\n' "$match" | apply_start_mode "$allow_skip" | apply_extra_args)
  launch_records "$match" || die '执行失败，工作目录可能不存在'
}
