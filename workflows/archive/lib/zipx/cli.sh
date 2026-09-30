# 命令行层：帮助、参数解析、动作分发，以及不带参数时的主菜单。
# 加载顺序放在最后：它引用的动作函数必须先加载完。

usage() {
  cat <<'EOF'
用法: zipx [动作] [选项] [参数]

不带任何参数时打开菜单；只给条目没给动作时，按 pack 处理。

动作:
  pack [条目...]       把当前目录下的条目打成 zip
  unpack 包 [条目...]  解压整个包，或只解包内指定条目
  extract 包 条目...   只提取包内指定条目，等价于 unpack 带条目
  list 包              列出包内文件
  test 包              校验包的完整性
  add 包 文件...       往已有包里追加文件，撞同名条目是更新
  rm 包 条目...        删掉包内条目，删前会确认

选项:
  -o, --output 包名    pack 的输出包名，默认取当前目录名加 .zip
  -d, --into 目录      unpack、extract 解到哪，默认当前目录
  -e, --encrypt        pack 时加密，密码由 zip 自己交互提示输入
      --overwrite      允许覆盖：pack 撞同名包、unpack 撞同名文件时默认拒绝
      --no-exclude     打包时不套用默认排除规则
      --exclude 模式   再追加一条排除模式，可重复
  -y, --yes            rm 时不再逐条确认，非交互环境下必须加
  -n, --dry-run        只打印要执行的命令，不落盘
  -h, --help           显示本帮助

退出码: 0 成功，1 操作失败，2 用法错误，3 用户取消。

只管 zip 包，不支持 tar.gz 与 7z。包内条目名不是 UTF-8 时（老工具在 Windows 上
打的包）解出来会是乱码：本机 unzip 6.0 不支持指定包内编码，只能用别的工具转。
EOF
}

# 解析结果放全局。不用命令替换接：命令替换会开子 shell，函数里的赋值出不来。
ACTION=''
PACK_OUT=''
INTO=''
OVERWRITE=0
NO_EXCLUDE=0
ENCRYPT=0
ASSUME_YES=0
DRY_RUN=0
declare -a POSITIONAL=()
declare -a USER_EXCLUDES=()
declare -a ARCHIVE_ENTRIES=()
declare -a UI_ENTRIES=()

is_action() {
  case "$1" in
    pack|unpack|extract|list|test|add|rm) return 0 ;;
  esac
  return 1
}

# 选项后面缺值时报用法错。边界在这里判一次，后面取值就不用再兜底。
need_value() {
  local opt=$1 idx=$2 total=$3
  ((idx < total)) || usage_error "$opt 后面要跟一个值"
}

parse_args() {
  local -a args=("$@")
  local end_opts=0 i=0 a
  while ((i < ${#args[@]})); do
    a=${args[$i]}
    i=$((i + 1))

    # -- 之后的词一律当位置参数，名字里带减号也不怕
    if ((end_opts)); then
      POSITIONAL+=("$a")
      continue
    fi

    case "$a" in
      --) end_opts=1 ;;
      -h|--help) usage; exit 0 ;;
      -o|--output) need_value "$a" "$i" "${#args[@]}"; PACK_OUT=${args[$i]}; i=$((i + 1)) ;;
      -d|--into) need_value "$a" "$i" "${#args[@]}"; INTO=${args[$i]}; i=$((i + 1)) ;;
      --exclude) need_value "$a" "$i" "${#args[@]}"; USER_EXCLUDES+=("${args[$i]}"); i=$((i + 1)) ;;
      -e|--encrypt) ENCRYPT=1 ;;
      --overwrite) OVERWRITE=1 ;;
      --no-exclude) NO_EXCLUDE=1 ;;
      -y|--yes) ASSUME_YES=1 ;;
      -n|--dry-run) DRY_RUN=1 ;;
      -*) usage_error "未知选项 $a" ;;
      *)
        if [[ -z "$ACTION" ]] && is_action "$a"; then
          ACTION=$a
        else
          POSITIONAL+=("$a")
        fi
        ;;
    esac
  done
}

dispatch() {
  local -a pos=("${POSITIONAL[@]}")
  case "$ACTION" in
    pack) cmd_pack "${pos[@]}" ;;
    unpack) cmd_unpack "${pos[@]}" ;;
    extract) cmd_extract "${pos[@]}" ;;
    list) cmd_list "${pos[@]}" ;;
    test) cmd_test "${pos[@]}" ;;
    add) cmd_add "${pos[@]}" ;;
    rm) cmd_rm "${pos[@]}" ;;
  esac
}

# 主菜单循环。动作跑完回到这里，选退出或按取消才离开。
ui_main() {
  local choice
  while :; do
    choice=$(ui_menu 'zipx' '选一个动作' \
      pack '压缩：把当前目录的条目打成 zip' \
      unpack '解压：把 zip 解到当前目录或指定目录' \
      info '查看与校验：列包内文件、校验完整性' \
      edit '包内增删：追加文件、删条目、只提取几个条目' \
      quit '退出') || return "$EXIT_CANCEL"

    case "$choice" in
      pack) ui_pack ;;
      unpack) ui_unpack ;;
      info) ui_info ;;
      edit) ui_edit ;;
      quit) break ;;
    esac
  done
  return 0
}

main() {
  parse_args "$@"
  need_cmd zip
  need_cmd unzip
  # 终端探测只在这里做一次，必须在任何命令替换之前：界面函数是 out=$(ui_menu ...)
  # 这样调的，替换里的 stdout 是管道，那时候再判 [[ -t 1 ]] 永远为假。
  detect_ui_mode

  if [[ -z "$ACTION" ]]; then
    if ((${#POSITIONAL[@]})); then
      # 只给条目不给动作，按压缩处理。给的是包文件时提醒一句，这是最容易搞错的一步。
      ACTION=pack
      case "${POSITIONAL[0]}" in
        *.zip) info "没写动作，按压缩处理；要解压的是包，用 zipx unpack ${POSITIONAL[0]}" ;;
      esac
    else
      ui_main
      return $?
    fi
  fi

  dispatch
}
