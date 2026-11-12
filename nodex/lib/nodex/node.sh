# Node 工作区扫描：包管理器、工作区里的包与脚本由 scan.js 读，bash 只做判定与拼记录。
# 包列表在 prepare_packages 里填一次，其余文件只读。

readonly NODEX_SCAN_JS="$nodex_dir/nodex/scan.js"

NODE_PM='npm'
NODE_ROOT=''
declare -a NODE_PKGS=()
declare -A PKG_NAME=()
declare -A PKG_DEV=()
declare -A PKG_BUILD=()

# scan.js 的输出按 $FS 分列，行内再切一次；read -a 会吞掉末尾空列，按五列补齐。
NFRAG=()
node_split() {
  local i
  NFRAG=()
  IFS="$FS" read -r -a NFRAG <<< "$1"
  for ((i = ${#NFRAG[@]}; i < 5; i++)); do NFRAG[i]=''; done
}

# 从目录往上找最近的 package.json，它就是这次扫描的根；一路找不到就返回 1。
find_package_root() {
  local dir
  dir=$(cd "$1" 2>/dev/null && pwd) || return 1
  while :; do
    [[ -f "$dir/package.json" ]] && { printf '%s\n' "$dir"; return 0; }
    [[ "$dir" == '/' ]] && return 1
    dir=$(parent_dir "$dir")
  done
}

# 这个目录自己声明了工作区成员：package.json 里有 workspaces，或者放着 pnpm-workspace.yaml。
has_workspaces() {
  [[ -f "$1/pnpm-workspace.yaml" ]] && return 0
  [[ -f "$1/package.json" ]] && grep -q '"workspaces"' "$1/package.json" 2>/dev/null
}

# 网页里加工作区用：从目录往上找，取最外层声明了工作区的目录；都没有就用最近的 package.json。
find_workspace_root() {
  local dir nearest='' best=''
  dir=$(cd "$1" 2>/dev/null && pwd) || return 1
  while :; do
    if [[ -f "$dir/package.json" ]]; then
      [[ -n "$nearest" ]] || nearest=$dir
      has_workspaces "$dir" && best=$dir
    fi
    [[ "$dir" == '/' ]] && break
    dir=$(parent_dir "$dir")
  done
  [[ -n "$best" ]] && { printf '%s\n' "$best"; return 0; }
  [[ -n "$nearest" ]] && { printf '%s\n' "$nearest"; return 0; }
  return 1
}

# 扫一个根，填全局表。必须在主 shell 里做：收集函数在命令替换的子 shell 里跑，子 shell 的写入随其丢失。
prepare_packages() {
  local root=$1 pmroot line kind rel name dev build
  command -v node >/dev/null 2>&1 || die '找不到 node，确认 Node.js 在 PATH 中'

  # 包管理器与锁文件看工作区根：在子包里执行时也要用整个工作区那一套。
  pmroot=$(find_workspace_root "$root") || pmroot=$root

  NODE_ROOT=$root
  NODE_PM='npm'
  NODE_PKGS=()
  PKG_NAME=()
  PKG_DEV=()
  PKG_BUILD=()

  while IFS= read -r line; do
    node_split "$line"
    kind=${NFRAG[0]}
    rel=${NFRAG[1]}
    name=${NFRAG[2]}
    dev=${NFRAG[3]}
    build=${NFRAG[4]}
    case "$kind" in
      meta) NODE_PM=${rel:-npm} ;;
      pkg)
        [[ -n "$rel" ]] || continue
        NODE_PKGS+=("$rel")
        PKG_NAME[$rel]=${name:-$rel}
        PKG_DEV[$rel]=$dev
        PKG_BUILD[$rel]=$build
        ;;
    esac
  done < <(node "$NODEX_SCAN_JS" "$root" "$pmroot" 2>/dev/null)

  ((${#NODE_PKGS[@]})) || die "$root 下没有读到 package.json"
}

# 包目录：相对路径为 . 时就是工作区根。
pkg_dir() {
  local rel=$1
  [[ "$rel" == '.' ]] && { printf '%s\n' "$NODE_ROOT"; return 0; }
  printf '%s/%s\n' "$NODE_ROOT" "$rel"
}

# 一条动作记录：标签、工作目录、包目录、参数、展示路径、展示命令。
emit_action_record() {
  local dir=$1 rel=$2 name=$3 script=$4
  emit_record "$name" "$dir" "$rel" "run $script" "$rel" "$NODE_PM run $script"
}

each_package_do() {
  local pred=$1 cb=$2 rel dir
  for rel in "${NODE_PKGS[@]}"; do
    "$pred" "$rel" || continue
    dir=$(pkg_dir "$rel")
    "$cb" "$dir" "$rel" "${PKG_NAME[$rel]}"
  done
  return 0
}

# 一个包有多个同类脚本时逐个出记录；不止一个就在名字后面缀上脚本名，标签才不撞。
emit_script_records() {
  local dir=$1 rel=$2 name=$3 script
  local -a scripts=()
  read -r -a scripts <<< "$4"
  for script in "${scripts[@]}"; do
    if ((${#scripts[@]} > 1)); then
      emit_action_record "$dir" "$rel" "$name:$script" "$script"
    else
      emit_action_record "$dir" "$rel" "$name" "$script"
    fi
  done
}

# 有启动脚本（dev、start、serve 及其带冒号的变体）的包。
has_dev() { [[ -n "${PKG_DEV[$1]:-}" ]]; }
emit_dev_record() { emit_script_records "$1" "$2" "$3" "${PKG_DEV[$2]}"; }
collect_dev() { each_package_do has_dev emit_dev_record; }

# 有 build 脚本（含 build: 开头的变体）的包。
has_build() { [[ -n "${PKG_BUILD[$1]:-}" ]]; }
emit_build_record() { emit_script_records "$1" "$2" "$3" "${PKG_BUILD[$2]}"; }
collect_build() { each_package_do has_build emit_build_record; }

# 安装依赖：根一行装整个工作区；子包各一行，按包管理器的选择器只装这个包。
# 三种包管理器都从根目录执行，选择器的写法各不相同。
install_args_for() {
  local name=$1
  case "$NODE_PM" in
    pnpm) printf '%s\n' "--filter $name install" ;;
    yarn) printf '%s\n' "workspace $name install" ;;
    *) printf '%s\n' "install --workspace $name" ;;
  esac
}

collect_install() {
  local rel name args base
  base=${PKG_NAME[.]:-$(basename "$NODE_ROOT")}
  emit_record "$base" "$NODE_ROOT" '' 'install' '.' "$NODE_PM install"

  for rel in "${NODE_PKGS[@]}"; do
    [[ "$rel" == '.' ]] && continue
    name=${PKG_NAME[$rel]}
    args=$(install_args_for "$name")
    emit_record "$name" "$NODE_ROOT" "$rel" "$args" "$rel" "$NODE_PM $args"
  done
  return 0
}
