# @Author: Himmeltala
# @Date: 2026-11-28 21:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 21:10:00
# @FilePath: \install\lib/deps.sh
# @Description: 可选依赖入口：列出、校验并调用 install/deps/<名字>.sh。

# 可选依赖：install/deps/<名字>.sh，第一行 `# deps: 说明` 供 --list-deps 使用。
deps_dir() {
  printf '%s/install/deps' "$SRC_DIR"
}

dep_desc() {
  awk 'NR <= 5 && /^# deps: / { sub(/^# deps: /, ""); print; exit }' "$1"
}

list_deps() {
  local file name desc
  shopt -s nullglob
  for file in "$(deps_dir)"/*.sh; do
    name=${file##*/}
    name=${name%.sh}
    desc=$(dep_desc "$file")
    printf '  %-14s %s\n' "$name" "${desc:-}"
  done
  shopt -u nullglob
}

run_dep() {
  local name=$1 file
  [[ "$name" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "依赖名不合法: $name"
  file="$(deps_dir)/$name.sh"
  [[ -f "$file" ]] || die "没有这个可选依赖: $name；用 install.sh --list-deps 查看"
  info "安装依赖: $name"
  bash "$file" || die "依赖 $name 安装失败"
}

install_deps() {
  local list=$1 item
  local -a items
  if [[ "$list" == all ]]; then
    shopt -s nullglob
    for item in "$(deps_dir)"/*.sh; do
      item=${item##*/}
      run_dep "${item%.sh}"
    done
    shopt -u nullglob
    return 0
  fi
  IFS=',' read -r -a items <<<"$list"
  for item in "${items[@]}"; do
    item=${item//[[:space:]]/}
    [[ -n "$item" ]] || continue
    run_dep "$item"
  done
}

