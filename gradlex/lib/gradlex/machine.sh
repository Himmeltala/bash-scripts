# 机器接口：--list --json 供 jvmx 网页壳读目标，exec --id 执行单个目标。
# 记录六段：标签|构建根|项目路径|任务|展示路径|展示命令；id 取「命令:标签」。

json_escape() {
  local text=$1
  text=${text//\\/\\\\}
  text=${text//\"/\\\"}
  text=${text//$'\n'/\\n}
  text=${text//$'\r'/\\r}
  text=${text//$'\t'/\\t}
  printf '%s' "$text"
}

machine_collect() {
  local cmd=$1
  "$(command_field "$cmd" 3)" | assign_tags | apply_start_mode
}

machine_json() {
  local cmd=$1 first=1 rec tag workdir projectpath taskargs display cmdtext
  printf '{"command":"%s","root":"%s","targets":[' \
    "$(json_escape "$cmd")" "$(json_escape "$PWD")"
  while IFS= read -r rec; do
    [[ -n "$rec" ]] || continue
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
    ((first)) || printf ','
    first=0
    printf '{"id":"%s","command":"%s","tag":"%s","path":"%s","cwd":"%s","display":"%s"}' \
      "$(json_escape "$cmd:$tag")" "$(json_escape "$cmd")" "$(json_escape "$tag")" \
      "$(json_escape "$projectpath")" "$(json_escape "$workdir")" "$(json_escape "$cmdtext")"
  done < <(machine_collect "$cmd")
  printf ']}\n'
}

# 网页每行保存的参数追加到任务尾部，展示命令同步重拼。
apply_extra_args() {
  local rec tag workdir projectpath taskargs display cmdtext
  while IFS= read -r rec; do
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
    if [[ -n "$EXTRA_ARGS" ]]; then
      taskargs="${taskargs:+$taskargs }$EXTRA_ARGS"
      cmdtext='gradle'
      if ((REBUILD)); then
        if [[ -n "$projectpath" ]]; then
          cmdtext+=" $projectpath:clean $projectpath:$taskargs"
        else
          cmdtext+=" clean $taskargs"
        fi
      elif [[ -n "$projectpath" ]]; then
        cmdtext+=" $projectpath:$taskargs"
      else
        cmdtext+=" $taskargs"
      fi
      ((REFRESH_DEPS)) && cmdtext+=' --refresh-dependencies'
    fi
    emit_record "$tag" "$workdir" "$projectpath" "$taskargs" "$display" "$cmdtext"
  done
}

machine_exec() {
  local id=$EXEC_ID
  [[ -n "$id" ]] || usage_error 'exec 需要 --id'

  local cmd=${id%%:*}
  command_exists "$cmd" || usage_error "未知目标 $id"

  prepare_scan "$PWD"
  local rec match='' tag
  while IFS= read -r rec; do
    IFS=$FS read -r tag _ <<< "$rec"
    if [[ "$cmd:$tag" == "$id" ]]; then
      match=$rec
      break
    fi
  done < <(machine_collect "$cmd")
  [[ -n "$match" ]] || die "没有目标 $id" "$EXIT_USAGE"

  match=$(printf '%s\n' "$match" | apply_extra_args)
  launch_records "$match" || die '执行失败，构建目录可能不存在'
}
