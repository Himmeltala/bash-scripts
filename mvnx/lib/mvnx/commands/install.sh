# install 命令：把顶层项目（未被任何聚合 pom 收录的 pom）clean install 装进本地仓库。
# 带 maven.resources.skip，装出的 jar 没有 application.yml 等资源，只适合补依赖，不适合部署。
readonly INSTALL_COMMAND='install'
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

# 按模块安装的参数：默认带 -am，把选中模块依赖的兄弟模块一起构建；--no-am 去掉。
install_module_args() {
  local args=$INSTALL_ARGS
  ((NO_AM)) || args+=' -am'
  printf '%s\n' "$args"
}

# 递归收集一个项目下可选装的子模块；pom 打包模块本身不装，只借它的 <modules> 往下走。
# 标签加项目前缀，不同项目的同名模块不会撞车。
emit_project_modules() {
  local root=$1 project_tag=$2
  local -a queue=("$root")
  local -A visited=([$root]=1) tag_seen=()
  local qi=0 dir entry sub rel id tag args
  while ((qi < ${#queue[@]})); do
    dir=${queue[$qi]}
    qi=$((qi + 1))

    while IFS= read -r entry; do
      [[ -n "$entry" ]] || continue
      sub=$(normalize_path "$dir/$entry")
      [[ -f "$sub/pom.xml" && -z "${visited[$sub]:-}" ]] || continue
      visited[$sub]=1
      queue+=("$sub")
      [[ -n "${POM_PKG_VAL[$sub/pom.xml]:-}" ]] && continue

      id=$(project_artifact_id "$sub/pom.xml")
      [[ -n "$id" ]] || id=$(basename "$sub")
      rel="${sub#"$root"/}"
      tag="$project_tag/$id"
      # 同一项目里出现同名模块时补路径，免得清单里两行分不清
      [[ -n "${tag_seen[$tag]:-}" ]] && tag+="@$rel"
      tag_seen[$tag]=1

      args=$(install_module_args)
      emit_record "$tag" "$root" "$rel" "$args" \
        "$(relative_to_pwd "$sub")" "mvn -pl $rel $args"
    done < <(pom_modules "$dir/pom.xml")
  done
  return 0
}

# install 的选择函数：顶层项目的子模块合成一张清单，顶部带「全部」；结果写进勾选记录。
select_install() {
  shift
  local -a projects=("$@") module_recs=() subs=()
  local rec tag workdir plpath mvnargs display cmdtext out rc=0

  for rec in "${projects[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    mapfile -t subs < <(emit_project_modules "$workdir" "$tag")
    # 独立项目没有子模块，把它自己放进清单，仍可按整个项目安装
    if ((${#subs[@]} == 0)); then
      subs=("$rec")
    fi
    module_recs+=("${subs[@]}")
  done

  out=$(ui_checklist_all '模块' "${module_recs[@]}") || rc=$?
  ((rc == 0)) || return "$rc"

  mapfile -t subs <<< "$out"
  save_selection "${subs[@]}"
  printf '%s\n' "${subs[@]}"
  return 0
}
