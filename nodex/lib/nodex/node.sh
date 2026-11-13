# Node 工作区扫描：包管理器、工作区里的脚本由 scan.js 读，bash 只做判定与拼记录。
# 脚本列表在 prepare_scripts 里填一次，其余文件只读。

readonly NODEX_SCAN_JS="$nodex_dir/nodex/scan.js"

NODE_PM='npm'
NODE_ROOT=''
declare -a NODE_SCRIPTS=()
declare -A SCRIPT_NAME=()
declare -A SCRIPT_DEV=()
declare -A SCRIPT_BUILD=()

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
prepare_scripts() {
  local root=$1 pmroot line kind rel name dev build
  command -v node >/dev/null 2>&1 || die '找不到 node，确认 Node.js 在 PATH 中'

  # 包管理器与锁文件看工作区根：在子包里执行时也要用整个工作区那一套。
  pmroot=$(find_workspace_root "$root") || pmroot=$root

  NODE_ROOT=$root
  NODE_PM='npm'
  NODE_SCRIPTS=()
  SCRIPT_NAME=()
  SCRIPT_DEV=()
  SCRIPT_BUILD=()

  while IFS= read -r line; do
    node_split "$line"
    kind=${NFRAG[0]}
    rel=${NFRAG[1]}
    name=${NFRAG[2]}
    dev=${NFRAG[3]}
    build=${NFRAG[4]}
    case "$kind" in
      meta) NODE_PM=${rel:-npm} ;;
      script)
        [[ -n "$rel" ]] || continue
        NODE_SCRIPTS+=("$rel")
        SCRIPT_NAME[$rel]=${name:-$rel}
        SCRIPT_DEV[$rel]=$dev
        SCRIPT_BUILD[$rel]=$build
        ;;
    esac
  done < <(node "$NODEX_SCAN_JS" "$root" "$pmroot" 2>/dev/null)

  ((${#NODE_SCRIPTS[@]})) || die "$root 下没有读到 package.json"
}

# 脚本所在目录：相对路径为 . 时就是工作区根。
script_dir() {
  local rel=$1
  [[ "$rel" == '.' ]] && { printf '%s\n' "$NODE_ROOT"; return 0; }
  printf '%s/%s\n' "$NODE_ROOT" "$rel"
}

# 一条动作记录：标签、工作目录、脚本目录、完整命令、展示路径、展示命令。
emit_action_record() {
  local dir=$1 rel=$2 name=$3 script=$4
  emit_record "$name" "$dir" "$rel" "$NODE_PM run $script" "$rel" "$NODE_PM run $script"
}

each_script_do() {
  local pred=$1 cb=$2 rel dir
  for rel in "${NODE_SCRIPTS[@]}"; do
    "$pred" "$rel" || continue
    dir=$(script_dir "$rel")
    "$cb" "$dir" "$rel" "${SCRIPT_NAME[$rel]}"
  done
  return 0
}

# 一个目录有多个同类脚本时逐个出记录；不止一个就在名字后面缀上脚本名，标签才不撞。
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

# 有启动脚本（dev、start、serve 及其带冒号的变体）的目录各出一条。
has_dev() { [[ -n "${SCRIPT_DEV[$1]:-}" ]]; }
emit_dev_record() { emit_script_records "$1" "$2" "$3" "${SCRIPT_DEV[$2]}"; }
collect_dev() { each_script_do has_dev emit_dev_record; }

# 有 build 脚本（含 build: 开头的变体）的目录各出一条。
has_build() { [[ -n "${SCRIPT_BUILD[$1]:-}" ]]; }
emit_build_record() { emit_script_records "$1" "$2" "$3" "${SCRIPT_BUILD[$2]}"; }
collect_build() { each_script_do has_build emit_build_record; }

# 安装依赖：命令默认 npm install，用户可以在网页里改成 pnpm 或 yarn 的写法。
# 根一行装整个工作区；子目录各一行，用 npm 的工作区选择器只装这个目录的依赖。
collect_install() {
  local rel name args base
  base=${SCRIPT_NAME[.]:-$(basename "$NODE_ROOT")}
  emit_record "$base" "$NODE_ROOT" '' 'npm install' '.' 'npm install'

  for rel in "${NODE_SCRIPTS[@]}"; do
    [[ "$rel" == '.' ]] && continue
    name=${SCRIPT_NAME[$rel]}
    args="npm install --workspace $name"
    emit_record "$name" "$NODE_ROOT" "$rel" "$args" "$rel" "$args"
  done
  return 0
}
