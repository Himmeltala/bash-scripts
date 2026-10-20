# package 命令：把可运行模块打成可部署的 jar；参数由 --no-am 与 --no-clean 现拼，默认 clean、跳过测试、-am。
# PACK_FLAG 记最后写的开关，只用于在别的命令带上时报出名字。
readonly PACKAGE_COMMAND='package'
# -am 连兄弟模块一起构建；跳过测试省去编译测试类与运行测试的时间，打出的是可运行版本，不是验证过的版本。
package_args() {
  local args=''
  [[ $PACK_NO_CLEAN -eq 0 ]] && args='clean '
  args+='package -Dmaven.test.skip=true'
  ((NO_AM)) || args+=' -am'
  printf '%s\n' "$args"
}

emit_package_record() {
  local dir=$1 id=$2 agg=$3 rel=$4
  local args
  args=$(package_args)
  if [[ -n "$rel" ]]; then
    emit_record "$id" "$agg" "$rel" "$args" \
      "$(relative_to_pwd "$dir")" "mvn -pl $rel $args"
  else
    emit_record "$id" "$dir" '' "$args" \
      "$(relative_to_pwd "$dir")" "mvn $args"
  fi
}

collect_packable() {
  each_module is_boot_module emit_package_record
}

PACK_NO_CLEAN=0
PACK_NO_CLEAN_FLAG=''
