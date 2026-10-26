# 清理项注册表：每项是一组字段，执行器只认字段，不认具体工具。

declare -a ITEM_IDS=()
declare -A ITEM_CATEGORY=()
declare -A ITEM_LABEL=()
declare -A ITEM_DESC=()
declare -A ITEM_KIND=()
declare -A ITEM_DATA=()
declare -A ITEM_MEASURE=()
declare -A ITEM_ROOT=()
declare -A ITEM_DEFAULT=()
declare -A ITEM_AVAILABLE=()

# 字段依次为：编号、类别、标题、说明、类型、路径或函数、测量函数、需要 root、默认勾选、可用性函数。
# path 类型的 data 是换行分隔的绝对路径；func 类型的 data 是清理函数名。
register_item() {
  local id=$1 category=$2 label=$3 desc=$4 kind=$5 data=$6
  local measure=${7:-} root=${8:-0} default=${9:-0} available=${10:-}

  [[ -n ${ITEM_CATEGORY[$id]:-} ]] && die "清理项 $id 重复注册"
  ITEM_IDS+=("$id")
  ITEM_CATEGORY[$id]=$category
  ITEM_LABEL[$id]=$label
  ITEM_DESC[$id]=$desc
  ITEM_KIND[$id]=$kind
  ITEM_DATA[$id]=$data
  ITEM_MEASURE[$id]=$measure
  ITEM_ROOT[$id]=$root
  ITEM_DEFAULT[$id]=$default
  ITEM_AVAILABLE[$id]=$available
}

item_exists() { [[ -n ${ITEM_CATEGORY[$1]:-} ]]; }

# path 类型只要有一条路径存在就算可用；func 类型交给可用性函数，没写就默认可用。
paths_exist() {
  local data=$1 line
  while IFS= read -r line; do
    [[ -n $line && -e $line ]] && return 0
  done <<<"$data"
  return 1
}

item_available() {
  local id=$1 kind=${ITEM_KIND[$id]} available=${ITEM_AVAILABLE[$id]:-}
  case "$kind" in
    path) paths_exist "${ITEM_DATA[$id]}" ;;
    func) [[ -z $available ]] || "$available" ;;
    *) return 1 ;;
  esac
}

# 路径项把各条路径的大小相加；一条都不存在时返回 0，删除后的复测靠它得到 0。
measure_paths() {
  local data=$1 line size total=0 existing=0 found=0
  while IFS= read -r line; do
    [[ -n $line && -e $line ]] || continue
    existing=1
    size=$(du -sb -- "$line" 2>/dev/null | awk '{print $1}')
    [[ -n $size ]] || continue
    found=1
    total=$((total + size))
  done <<<"$data"
  if ((existing)) && ((!found)); then
    return 1
  fi
  printf '%s\n' "$total"
}

item_size() {
  local id=$1 kind=${ITEM_KIND[$id]} measure=${ITEM_MEASURE[$id]:-}
  case "$kind" in
    path) measure_paths "${ITEM_DATA[$id]}" ;;
    func) [[ -n $measure ]] && "$measure" ;;
    *) return 1 ;;
  esac
}

# 结果放 CAT_IDS，调用方按需逐个处理。
CAT_IDS=()

collect_category() {
  local category=$1 id
  CAT_IDS=()
  for id in "${ITEM_IDS[@]}"; do
    [[ ${ITEM_CATEGORY[$id]} == "$category" ]] || continue
    item_available "$id" || continue
    CAT_IDS+=("$id")
  done
  ((${#CAT_IDS[@]}))
}
