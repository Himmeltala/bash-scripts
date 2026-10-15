# war 命令的收集函数：把引了 jetty 或 tomcat 插件的 war 项目拼成对应的 run 记录。
# 判定在 pom.sh 的 is_war_module 里，具体打哪个目标读 WEBRUN_GOAL。
emit_war_record() {
  local dir=$1 id=$2 agg=$3 rel=$4
  local goal=${WEBRUN_GOAL[$dir]:-}
  [[ -n "$goal" ]] || return 0
  if [[ -n "$rel" ]]; then
    emit_record "$id" "$agg" "$rel" "$goal" \
      "$(relative_to_pwd "$dir")" "mvn -pl $rel $goal"
  else
    emit_record "$id" "$dir" '' "$goal" \
      "$(relative_to_pwd "$dir")" "mvn $goal"
  fi
}

collect_war() {
  each_module is_war_module emit_war_record
}
