# 查看与校验：列包内文件、校验包的完整性。

# 命令输出量可能很大，界面模式下先落到临时文件再分页看。
# 非界面模式直接打出来，把输出留在终端上，方便配合管道与重定向。
show_output() {
  local title=$1
  shift
  if ui_available; then
    local tmp rc
    tmp=$(mktemp) || die '建不了临时文件'
    "$@" > "$tmp" 2>&1
    rc=$?
    ui_textbox "$title" "$tmp"
    rm -f "$tmp"
    return "$rc"
  fi
  "$@"
}

cmd_list() {
  local pkg=${1:-}
  if [[ -z "$pkg" ]]; then
    pkg=$(ui_pick_archive) || return "$EXIT_CANCEL"
  fi
  [[ -f "$pkg" ]] || die "找不到包「$pkg」"
  # unzip 自己的失败码有 9、10、50 这些，本工具的退出码只有 0 到 3。
  # 统一收成 1，调用方按约定判断就行，不必去查 unzip 的码表。
  local rc=0
  show_output 'zipx 包内文件' unzip -l "$(archive_arg "$pkg")" || rc=$?
  ((rc == 0)) || die "「$pkg」读不了，不是一个正常的 zip 包（unzip 退出码 $rc）"
}

cmd_test() {
  local pkg=${1:-}
  if [[ -z "$pkg" ]]; then
    pkg=$(ui_pick_archive) || return "$EXIT_CANCEL"
  fi
  [[ -f "$pkg" ]] || die "找不到包「$pkg」"
  local rc=0
  show_output 'zipx 完整性校验' unzip -t "$(archive_arg "$pkg")" || rc=$?
  if ((rc == 0)); then
    info "「$pkg」完整性没问题"
    return 0
  fi
  info "「$pkg」校验未通过，包可能损坏（unzip 退出码 $rc）"
  return "$EXIT_FAIL"
}

ui_info() {
  local pkg action
  pkg=$(ui_pick_archive) || return "$EXIT_CANCEL"
  action=$(ui_menu 'zipx 查看与校验' "包：$pkg" \
    list '列出包内文件' \
    test '校验包的完整性') || return "$EXIT_CANCEL"

  case "$action" in
    list) cmd_list "$pkg" ;;
    test) cmd_test "$pkg" ;;
  esac
}
