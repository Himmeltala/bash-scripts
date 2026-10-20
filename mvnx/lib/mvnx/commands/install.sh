# install 命令：把顶层项目 clean install 装进本地仓库。
# 顶层项目指的是没有被任何上层聚合 pom 收录的 pom。
# 快速装依赖用。带了 maven.resources.skip，装出来的 jar 里没有 application.yml 这类资源，
# 只适合给本地仓库补齐依赖，不适合拿去部署。
readonly INSTALL_COMMAND='install'
readonly INSTALL_ARGS='clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true'
# 第一屏的首行开关。勾上就逐个项目进第二屏选模块，不勾则按整个项目装。
readonly INSTALL_SWITCH_TAG='按模块选择'

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

# 按模块安装的参数。-am 把选中的模块依赖的兄弟模块一起构建，
# 兄弟模块还没进本地仓库时也能一次装成功；--no-am 去掉它。
install_module_args() {
  local args=$INSTALL_ARGS
  ((NO_AM)) || args+=' -am'
  printf '%s\n' "$args"
}

# 递归收集一个项目下可选装的子模块，输出记录。
# pom 打包的模块本身不装，只借它的 <modules> 继续往下走。
# 标签加项目前缀，不同项目里的同名模块不会撞车。
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

# install 的选择函数：第一屏项目清单带「按模块选择」开关，
# 开关勾上时对每个勾中的项目再弹一次模块清单。
# 两次勾选的结果都由这里写进勾选记录，run_action 看到选择函数就不再写一遍。
select_install() {
  local noun=$1
  shift
  local -a recs=("$@") projects=() modules=() module_recs=()
  local switch_rec out rc=0 rec mod_out mod_rec
  local tag workdir plpath mvnargs display cmdtext

  switch_rec=$(emit_record "$INSTALL_SWITCH_TAG" '' '' '' '勾上则稍后逐个选模块' '')
  out=$(ui_checklist "$noun" "$switch_rec" "${recs[@]}") || rc=$?
  ((rc == 0)) || return "$rc"

  local module_mode=0
  while IFS= read -r rec; do
    [[ -n "$rec" ]] || continue
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    if [[ "$tag" == "$INSTALL_SWITCH_TAG" ]]; then
      module_mode=1
    else
      projects+=("$rec")
    fi
  done <<< "$out"

  # 只勾了开关没勾项目，等同于什么都没选
  ((${#projects[@]})) || return 2

  if ((module_mode == 0)); then
    save_selection "${projects[@]}"
    printf '%s\n' "${projects[@]}"
    return 0
  fi

  for rec in "${projects[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    module_recs=()
    mapfile -t module_recs < <(emit_project_modules "$workdir" "$tag")
    # 独立项目没有子模块，退回按整个项目安装
    if ((${#module_recs[@]} == 0)); then
      modules+=("$rec")
      continue
    fi

    rc=0
    mod_out=$(ui_checklist '模块' "${module_recs[@]}") || rc=$?
    ((rc == 0)) || return "$rc"
    while IFS= read -r mod_rec; do
      [[ -n "$mod_rec" ]] && modules+=("$mod_rec")
    done <<< "$mod_out"
  done

  save_selection "${projects[@]}" "${modules[@]}"
  printf '%s\n' "${modules[@]}"
  return 0
}
