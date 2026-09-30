# 包内增删：往已有包里追加文件、删掉包内条目、只提取其中几个条目。

# 从包内清单里勾选条目。desc 用目录与文件区分，目录项的名字以斜杠结尾。
ui_pick_archive_entries() {
  local pkg=$1 purpose=$2
  load_archive_entries "$pkg" || die "「$pkg」不是 zip 包，或者里面一个条目都没有"

  local -a items=()
  local n desc
  for n in "${ARCHIVE_ENTRIES[@]}"; do
    if [[ "$n" == */ ]]; then desc='目录'; else desc='文件'; fi
    items+=("$n" "$desc" OFF)
  done
  ui_checklist "$purpose" '空格勾选包内条目，回车确认' "${items[@]}"
}

cmd_add() {
  local pkg=${1:-}
  shift || true
  local -a files=("$@")

  [[ -n "$pkg" ]] || usage_error '要说清往哪个包里追加'
  [[ -f "$pkg" ]] || die "找不到包「$pkg」"

  if ((${#files[@]} == 0)); then
    local out
    out=$(ui_pick_entries) || return "$EXIT_CANCEL"
    [[ -n "$out" ]] || die '一个文件都没勾'
    mapfile -t files <<< "$out"
  fi

  # zip 对包里已有的同名条目是更新，不是拒绝，重名的会被盖掉。
  run_cmd zip "$(archive_arg "$pkg")" "${files[@]}" || die '追加失败，看上面的 zip 输出'
  info "已更新 $pkg"
}

cmd_rm() {
  local pkg=${1:-}
  shift || true
  local -a names=("$@")

  [[ -n "$pkg" ]] || usage_error '要说清从哪个包里删'
  [[ -f "$pkg" ]] || die "找不到包「$pkg」"
  load_archive_entries "$pkg" || die "「$pkg」不是 zip 包，或者里面一个条目都没有"

  if ((${#names[@]} == 0)); then
    local out
    out=$(ui_pick_archive_entries "$pkg" 'zipx 删除条目') || return "$EXIT_CANCEL"
    [[ -n "$out" ]] || die '一个条目都没勾'
    mapfile -t names <<< "$out"
  fi

  # 删条目不可逆：zip -d 直接从包里摘掉，没有回收站，所以默认要确认一次。
  if ((ASSUME_YES == 0)); then
    if ui_available; then
      ui_yesno 'zipx 删除条目' "将从 $pkg 删掉 ${#names[@]} 个条目，删掉找不回来，确认吗？" ||
        return "$EXIT_CANCEL"
    else
      die '非交互环境下删条目要显式加 --yes'
    fi
  fi

  run_cmd zip -d "$(archive_arg "$pkg")" "${names[@]}" || die '删除失败，看上面的 zip 输出'
  info "已更新 $pkg"
}

cmd_extract() {
  local pkg=${1:-}
  shift || true
  local -a names=("$@")

  [[ -n "$pkg" ]] || usage_error '要说清从哪个包里提'
  [[ -f "$pkg" ]] || die "找不到包「$pkg」"
  load_archive_entries "$pkg" || die "「$pkg」不是 zip 包，或者里面一个条目都没有"

  if ((${#names[@]} == 0)); then
    local out
    out=$(ui_pick_archive_entries "$pkg" 'zipx 提取条目') || return "$EXIT_CANCEL"
    [[ -n "$out" ]] || die '一个条目都没勾'
    mapfile -t names <<< "$out"
  fi

  # 提取就是带条目名解压，直接复用解压那条路，覆盖策略与检查都一致。
  cmd_unpack "$pkg" "${names[@]}"
}

ui_edit() {
  local pkg action
  pkg=$(ui_pick_archive) || return "$EXIT_CANCEL"
  action=$(ui_menu 'zipx 包内增删' "包：$pkg" \
    add '把当前目录的文件追加进这个包' \
    rm '删掉包内条目' \
    extract '只提取包内几个条目') || return "$EXIT_CANCEL"

  case "$action" in
    add) cmd_add "$pkg" ;;
    rm) cmd_rm "$pkg" ;;
    extract) cmd_extract "$pkg" ;;
  esac
}
