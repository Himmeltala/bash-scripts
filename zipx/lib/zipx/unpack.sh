# 解压：把包整个解出来，或只解包内指定条目。

list_archives() {
  local e
  shopt -s nullglob
  for e in *.zip; do
    printf '%s\n' "$e"
  done
  shopt -u nullglob
}

# 取包内条目清单填进全局 ARCHIVE_ENTRIES；-Z1 只列名字，比 -l 好拆。
# 不是 zip 或里面一个条目都没有，都算取不到。
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

# 包内条目名是否安全：绝对路径、Windows 盘符、含 .. 的条目会写到目标目录外（zip slip）；unzip 6.0 只拦一部分，不指望它。
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

# 包内名是否像乱码：老工具在 Windows 上打的包写入 GBK 名且不置 UTF-8 标记，unzip 按 cp437 转出一串框线与块字符。
# 字节层面仍是合法 UTF-8，iconv 验不出来，所以看字符本身；纯提示，不影响解压。
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
  load_archive_entries "$pkg" || die "「$pkg」不是有效的 zip 包"
  archive_is_safe || die "「$pkg」有条目指向包外，拒绝解压"
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

  # 默认不覆盖同名文件：解压出错最常见的后果就是覆盖别人的文件。
  local -a cmd=(unzip)
  if ((OVERWRITE)); then cmd+=(-o); else cmd+=(-n); fi
  cmd+=(-d "$dir" "$(archive_arg "$pkg")")
  ((${#names[@]})) && cmd+=("${names[@]}")

  mkdir -p "$dir" || die "建不了目录「$dir」"
  # unzip 6.0 不支持指定包内编码（加 -O 直接报用法错），撞上乱码名时只能把话说清楚。
  if archive_names_look_mojibake; then
    info '条目名疑似乱码，解出的文件名也会乱；'
    info 'unzip 不支持指定编码，改用 7z 或 bsdtar'
  fi

  run_cmd "${cmd[@]}" || die '解压失败，看上面的 unzip 输出'
  info "已解压到 $dir"
}

# 界面流程：选包、问目标目录、问覆盖，再走 cmd_unpack。
ui_unpack() {
  local pkg dir
  pkg=$(ui_pick_archive) || return "$EXIT_CANCEL"

  dir=$(ui_input 'zipx 解压' '解到哪个目录' '.') || return "$EXIT_CANCEL"
  INTO=$dir

  if ui_yesno 'zipx 解压' '覆盖同名文件？选否跳过'; then
    OVERWRITE=1
  fi

  cmd_unpack "$pkg"
}

# 选一个包。当前目录下没有 zip 就让人直接输路径。
ui_pick_archive() {
  local -a zips=()
  mapfile -t zips < <(list_archives)
  if ((${#zips[@]} == 0)); then
    ui_input 'zipx' '当前目录没有 zip 包，输入包路径' ''
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
