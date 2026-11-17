# @Author: Himmeltala
# @Date: 2026-11-17 23:46:49
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-17 23:46:49
# @FilePath: \lib\shell-shared\services\command-table.sh
# @Description: 命令注册表与主菜单：命令查询、把注册表转成菜单项、菜单循环。
# 注册表由调用方以 COMMANDS 数组给出，每行以竖线分列：第一列命令名、第二列说明，其余列由工具自定。
# 主菜单依赖 bash-tui 的 ui_menu_named 与调用方的 run_action。
# shellcheck shell=bash
# shellcheck disable=SC2154

shell_command_exists() {
  local row
  for row in "${COMMANDS[@]}"; do
    [[ "${row%%|*}" == "$1" ]] && return 0
  done
  return 1
}

# 取注册表某行的第 idx 列，1 是命令名。纯 bash 拆，不调 cut。
shell_command_field() {
  local name=$1 idx=$2 row rest i
  for row in "${COMMANDS[@]}"; do
    [[ "${row%%|*}" == "$name" ]] || continue
    rest="${row#*|}"
    for ((i = 2; i < idx; i++)); do
      rest="${rest#*|}"
    done
    printf '%s\n' "${rest%%|*}"
    return 0
  done
  return 1
}

# 主菜单的选项从注册表生成，加命令时不必改调用方；末尾补一项退出。
shell_build_action_items() {
  UI_ACTION_ITEMS=()
  local row name
  for row in "${COMMANDS[@]}"; do
    name="${row%%|*}"
    UI_ACTION_ITEMS+=("$name" "$(shell_command_field "$name" 2)")
  done
  UI_ACTION_ITEMS+=('quit' '退出')
}

# 不带参数时的主菜单：先选动作再勾目标，执行完或返回上一步都回到这里，选退出才离开。
shell_ui_main() {
  local action rc=0
  while :; do
    action=$(ui_menu_named "$SHELL_TOOL" '选命令' "${UI_ACTION_ITEMS[@]}") || return "$EXIT_CANCEL"
    [[ "$action" == 'quit' ]] && break
    rc=0
    run_action "$action" || rc=$?
    ((rc == 0 || rc == EXIT_BACK)) && continue
    return "$rc"
  done
  return 0
}
