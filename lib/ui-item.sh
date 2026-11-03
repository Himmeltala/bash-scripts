# 条目文本：界面只画主文本与次要文本（中间用制表符分），标签不画；编号回退画标签加说明。
# 名字与标签相同时按模式决定名字写在哪，否则界面上只剩说明、编号里名字重复一遍。

# 结果写进全局 UI_ITEM_TEXT，不用命令替换，免得每个条目起一个子 shell。
UI_ITEM_TEXT=''

ui_item_text() {
  local name=$1 extra=$2
  if ui_available; then
    UI_ITEM_TEXT=$name$'\t'$extra
  else
    UI_ITEM_TEXT=$extra
  fi
  return 0
}

# 命令菜单：标签就是命令名或选项名，界面上主文本写命令名、说明作小字解释。
# 参数与 ui_menu 一样是成对的标签与说明，返回码原样透传。
# 数据列表（包名、会话标题、归档）仍用 ui_menu，那种列表的主文本该写数据本身。
ui_menu_named() {
  local title=$1 prompt=$2
  shift 2
  if (($# == 0 || $# % 2 != 0)); then
    printf 'ui_menu_named: 需要成对的命令名与说明\n' >&2
    return "$TUI_ERROR"
  fi

  local -a items=()
  while (($#)); do
    ui_item_text "$1" "$2"
    items+=("$1" "$UI_ITEM_TEXT")
    shift 2
  done
  ui_menu "$title" "$prompt" "${items[@]}"
}
