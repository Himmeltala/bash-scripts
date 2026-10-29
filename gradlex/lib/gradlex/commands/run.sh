# run 命令的收集函数：把可运行的 Boot 或 application 模块拼成启动记录。
emit_run_record() {
  local dir=$1 root=$2 projectpath=$3 id=$4
  local task=${MODULE_RUN_TASK[$dir]}
  [[ -n "$task" ]] || return 0

  if [[ -n "$projectpath" ]]; then
    emit_record "$id" "$root" "$projectpath" "$task" \
      "$(relative_to_pwd "$dir")" "gradle $projectpath:$task"
  else
    emit_record "$id" "$root" '' "$task" \
      "$(relative_to_pwd "$dir")" "gradle $task"
  fi
}

collect_runnable() {
  each_module is_runnable emit_run_record
}
