# package 命令：把可运行模块打成可部署的 jar。
# 参数由 --no-am 与 --no-clean 两个开关现拼，默认 clean 加跳过测试加 -am。
# 打包参数的两个开关只对 package 命令有效，默认都关着。
# PACK_FLAG 记下最后写的是哪一个，只用来在别的命令带上时报出名字。
readonly PACKAGE_COMMAND='package'
# package 的参数按开关现拼，见 usage。
# -am 让 Maven 连模块依赖的兄弟模块一起构建，兄弟模块还没装进本地仓库时也能一次打包成功。
# 跳过测试省下的是编译测试类与跑测试的时间，打出来的是能跑的东西，不是验证过的版本。
package_args() {
  local args=''
  [[ $PACK_NO_CLEAN -eq 0 ]] && args='clean '
  args+='package -Dmaven.test.skip=true'
  [[ $PACK_NO_AM -eq 0 ]] && args+=' -am'
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
  each_runnable_module emit_package_record
}

PACK_NO_AM=0
PACK_NO_CLEAN=0
PACK_FLAG=''
