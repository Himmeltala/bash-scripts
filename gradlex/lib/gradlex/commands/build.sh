# build 命令的收集函数：Boot 模块执行 bootJar，application 模块执行 assemble。
emit_build_record() {
  local dir=$1 root=$2 projectpath=$3 id=$4
  local task=${MODULE_BUILD_TASK[$dir]}
  [[ -n "$task" ]] || return 0

  if [[ -n "$projectpath" ]]; then
    emit_record "$id" "$root" "$projectpath" "$task" \
      "$(relative_to_pwd "$dir")" "gradle $projectpath:$task"
  else
    emit_record "$id" "$root" '' "$task" \
      "$(relative_to_pwd "$dir")" "gradle $task"
  fi
}

collect_buildable() {
  each_module is_buildable emit_build_record
}
