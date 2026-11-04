# tokx 交互界面：选报表、统计范围与来源，再调 Python 出表。
# 报表打印到终端而不是画在界面里，宽表不丢列，退出后还能翻回滚。

# 界面组件来自 bash-tui，路径由仓库根下的 tui-path.sh 定位。
if ! source "${BASH_SOURCE[0]%/*}/../../lib/tui-path.sh"; then
  return 1
fi

# 三个标准流都连着终端才画界面，否则 ui_* 自动退回编号输入。
_tokx_report() {
  local command=$1
  shift
  "${TOKX_PYTHON:-python3}" -m tokx "$command" "$@"
}

_tokx_menu_command() {
  ui_menu_named 'tokx' '看哪一类报表' \
    daily '按日汇总：每天每个来源的每个模型一行' \
    session '按会话汇总：每个会话的每个模型一行' \
    hour '按小时汇总：各时段中每个模型的用量' \
    prices '价格表：模型单价与峰谷时段' \
    quit '退出'
}

_tokx_menu_range() {
  ui_menu_named 'tokx · 统计范围' '看哪段时间' \
    today '今天' \
    week '近 7 天' \
    fortnight '近 14 天' \
    month '近 30 天' \
    all '全部历史' \
    custom '自定义起止日期'
}

_TOKX_RANGE=()
_tokx_custom_range() {
  local since='' until=''
  since=$(ui_input 'tokx · 起始日期' '起始日期，格式 YYYY-MM-DD，留空表示不限' '') || return 1
  until=$(ui_input 'tokx · 结束日期' '结束日期，格式 YYYY-MM-DD，留空表示不限' '') || return 1
  _TOKX_RANGE=(--since "$since" --until "$until")
  return 0
}

_tokx_menu_sources() {
  ui_checklist 'tokx · 来源' '空格勾选，回车确认' \
    claude 'Claude Code' ON \
    opencode 'opencode' ON \
    dsh 'DeepSeek Harness' ON
}

# 一次报表：先选范围再勾来源。取消或没勾来源都回主菜单，返回 1 表示看完选择退出。
_tokx_view() {
  local command=$1 choice=''
  local -a args=()

  choice=$(_tokx_menu_range) || return 0
  case "$choice" in
    today) args=(--days 1) ;;
    week) args=(--days 7) ;;
    fortnight) args=(--days 14) ;;
    month) args=(--days 30) ;;
    all) args=(--all) ;;
    custom)
      _tokx_custom_range || return 0
      args=("${_TOKX_RANGE[@]}")
      ;;
    *) return 0 ;;
  esac

  local out='' rc=0 source=''
  out=$(_tokx_menu_sources) || rc=$?
  if ((rc != 0)); then
    ((rc == TUI_EMPTY)) && printf '没有勾选来源，回到菜单。\n' >&2
    return 0
  fi
  while IFS= read -r source; do
    [[ -n $source ]] && args+=(-s "$source")
  done <<< "$out"

  printf '统计中…\n\n' >&2
  _tokx_report "$command" "${args[@]}"
  ui_pause '任意键回到菜单，q 退出' || return 1
  return 0
}

# 主菜单取消时按仓库惯例以 3 退出。
readonly TOKX_EXIT_CANCEL=3

# 主循环：报表看完回菜单，只有选退出、看完按 q 或主菜单取消才离开。
tokx_tui() {
  ui_detect
  local choice=''
  while :; do
    choice=$(_tokx_menu_command) || return "$TOKX_EXIT_CANCEL"
    case "$choice" in
      daily | session | hour) _tokx_view "$choice" || return 0 ;;
      prices) _tokx_report prices; ui_pause '任意键回到菜单，q 退出' || return 0 ;;
      quit) return 0 ;;
    esac
  done
}
