# 界面层：通用 ui_* 由 bash-tui 提供，这里只保留「没勾选按成功处理」的返回码映射。

zipx_ui_checklist() {
  local out=''
  local rc=0
  out=$(ui_checklist "$@") || rc=$?
  ((rc == TUI_EMPTY)) && return "$TUI_OK"
  ((rc == TUI_OK)) || return "$rc"
  printf '%s\n' "$out"
  return "$TUI_OK"
}
