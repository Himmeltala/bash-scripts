# install 命令：把顶层项目 clean install 装进本地仓库。
# 顶层项目指的是没有被任何上层聚合 pom 收录的 pom。
# 快速装依赖用。带了 maven.resources.skip，装出来的 jar 里没有 application.yml 这类资源，
# 只适合给本地仓库补齐依赖，不适合拿去部署。
readonly INSTALL_ARGS='clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true'
# install 命令的目标：没有被上层聚合 pom 收录的 pom，也就是一个能独立构建的项目。
collect_toplevel() {
  local pom dir id
  for pom in "${POM_LIST[@]}"; do
    dir=$(parent_dir "$pom")
    find_aggregator "$dir" >/dev/null && continue

    id=$(project_artifact_id "$pom")
    [[ -n "$id" ]] || id=$(basename "$dir")

    emit_record "$id" "$dir" '' "$INSTALL_ARGS" \
      "$(relative_to_pwd "$dir")" "mvn $INSTALL_ARGS"
  done
  return 0
}

