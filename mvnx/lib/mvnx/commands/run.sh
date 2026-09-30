# run 命令的收集函数：把可运行模块拼成 spring-boot:run 记录。
# 可运行模块的判定在 pom.sh 的 each_runnable_module 里，与 package 共用。
emit_run_record() {
  local dir=$1 id=$2 agg=$3 rel=$4
  if [[ -n "$rel" ]]; then
    emit_record "$id" "$agg" "$rel" 'spring-boot:run' \
      "$(relative_to_pwd "$dir")" "mvn -pl $rel spring-boot:run"
  else
    emit_record "$id" "$dir" '' 'spring-boot:run' \
      "$(relative_to_pwd "$dir")" 'mvn spring-boot:run'
  fi
}

collect_runnable() {
  each_runnable_module emit_run_record
}
