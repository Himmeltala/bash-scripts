# 解压：把包整个解出来，或只解包内指定条目。

# 当前目录下的 zip 包名。
list_archives() {
  local e
  shopt -s nullglob
  for e in *.zip; do
    printf '%s\n' "$e"
  done
  shopt -u nullglob
}

# 取包内条目清单，填进全局数组 ARCHIVE_ENTRIES。
# -Z1 只列名字，比 -l 少一堆列，读起来也好拆。
# 包不是 zip、或者里面一个条目都没有，都算取不到。
load_archive_entries() {
  local pkg=$1 name
  ARCHIVE_ENTRIES=()
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    reject_odd_name "$name"
    ARCHIVE_ENTRIES+=("$name")
  done < <(unzip -Z1 "$(archive_arg "$pkg")" 2>/dev/null)
  ((${#ARCHIVE_ENTRIES[@]})) || return 1
  return 0
}

# 包内条目名是否安全。绝对路径、Windows 盘符、含 .. 的条目解出来会写到目标目录
# 外面（zip slip）。unzip 6.0 自己会拦一部分，但各版本行为不一致，不指望它。
archive_is_safe() {
  local n
  for n in "${ARCHIVE_ENTRIES[@]}"; do
    case "$n" in
      /*) return 1 ;;
      [A-Za-z]:[\\/]*) return 1 ;;
    esac
    case "/$n/" in
      *'/../'*) return 1 ;;
    esac
  done
  return 0
}

# 包内名看着像不像乱码。老工具在 Windows 上打的包把 GBK 名字直接写进去，且不置
# UTF-8 标记；unzip 遇到这种名会按 cp437 转成本地编码，于是 GBK 字节变成一串
# 框线与块字符（╛、╔、░ 这类），字节层面却是合法 UTF-8，用 iconv 验不出来。
# 所以改成看字符本身：正常文件名不会成片出现框线与块字符。
# 纯提示用，判断结果不影响解压动作。
archive_names_look_mojibake() {
  command -v grep >/dev/null 2>&1 || return 1
  printf '%s\n' "${ARCHIVE_ENTRIES[@]}" |
    grep -qP '[\x{2500}-\x{259F}\x{25A0}-\x{25FF}]' 2>/dev/null
}

# 解压前的统一检查：包在不在、是不是 zip、条目名能不能安全解。
check_archive() {
  local pkg=$1
  [[ -n "$pkg" ]] || usage_error '要给一个包名'
  [[ -f "$pkg" ]] || die "找不到包「$pkg」"
  load_archive_entries "$pkg" || die "「$pkg」不是 zip 包，或者里面一个条目都没有"
  archive_is_safe || die "「$pkg」里有指向包外的条目（绝对路径或含 ..），拒绝解压"
}

cmd_unpack() {
  local pkg=${1:-}
  shift || true
  local -a names=("$@")
  local dir=${INTO:-.}

  if [[ -z "$pkg" ]]; then
    if ((${#names[@]} == 0)); then
      local out
      out=$(ui_pick_archive) || return "$EXIT_CANCEL"
      pkg=$out
    else
      usage_error '要说清解哪个包'
    fi
  fi
  check_archive "$pkg"

  if ((${#names[@]})); then
    local n
    for n in "${names[@]}"; do
      reject_odd_name "$n"
    done
  fi

  # 默认不覆盖同名文件：解压出错最常见的后果就是把别人的东西盖掉。
  local -a cmd=(unzip)
  if ((OVERWRITE)); then cmd+=(-o); else cmd+=(-n); fi
  cmd+=(-d "$dir" "$(archive_arg "$pkg")")
  ((${#names[@]})) && cmd+=("${names[@]}")

  mkdir -p "$dir" || die "建不了目录「$dir」"
  # unzip 6.0 不支持指定包内编码（加 -O 直接报用法错），撞上乱码名时只能把话说清楚。
  if archive_names_look_mojibake; then
    info '包内条目名像是乱码（非 UTF-8 名被按 cp437 解出来），解出来的文件名也会乱；'
    info '本机 unzip 不支持指定编码，要正常显示得换 7z、bsdtar 这类工具'
  fi

  run_cmd "${cmd[@]}" || die '解压失败，看上面的 unzip 输出'
  info "解压完成，目标目录 $dir"
}

# 界面流程：选包、问目标目录、问覆盖，再走 cmd_unpack。
ui_unpack() {
  local pkg dir
  pkg=$(ui_pick_archive) || return "$EXIT_CANCEL"

  dir=$(ui_input 'zipx 解压' '解到哪个目录' '.') || return "$EXIT_CANCEL"
  INTO=$dir

  if ui_yesno 'zipx 解压' '同名文件要覆盖吗？选否表示跳过已存在的文件'; then
    OVERWRITE=1
  fi

  cmd_unpack "$pkg"
}

# 选一个包。当前目录下没有 zip 就让人直接输路径。
ui_pick_archive() {
  local -a zips=()
  mapfile -t zips < <(list_archives)
  if ((${#zips[@]} == 0)); then
    ui_input 'zipx' '当前目录下没有 zip 包，直接输入包路径' ''
    return $?
  fi

  local -a items=()
  local z
  for z in "${zips[@]}"; do
    reject_odd_name "$z"
    items+=("$z" "$(du -h -- "$z" 2>/dev/null | cut -f1)")
  done
  ui_menu 'zipx' '选一个包' "${items[@]}"
}
