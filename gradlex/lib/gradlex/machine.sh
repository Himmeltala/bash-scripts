# 机器接口：--list --json 供 jvmx 网页壳读目标，exec --id 执行单个目标。
# 记录六段：标签|构建根|项目路径|任务|展示路径|展示命令；id 取「命令:标签」。

machine_collect() {
  local cmd=$1
  "$(shell_command_field "$cmd" 3)" | shell_assign_tags | apply_start_mode
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
  shell_command_exists "$cmd" || usage_error "未知目标 $id"

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
  shell_launch_records launch_one "$match" || die '执行失败，构建目录可能不存在'
}
