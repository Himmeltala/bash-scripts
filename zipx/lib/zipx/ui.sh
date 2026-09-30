# 界面层：whiptail 的几种控件，以及探不到终端时的编号输入。
# whiptail 把结果写在 stderr 上（--menu、--checklist 都是如此，与 dialog 相反），
# 取结果的地方一律用 3>&1 1>&2 2>&3 把两边调换过来。
# 所有函数输出到 stdout；返回 1 表示用户取消，其余非零交给调用方判断。

# 列表框尺寸。行数按条目数取，最多留 8 行给边框与提示；
# 列表高度给不够时 whiptail 只显示一部分，滚动行为也不对。
ui_size() {
  local n=$1 lines cols listh
  lines=$(tput lines 2>/dev/null || printf '24')
  cols=$(tput cols 2>/dev/null || printf '100')
  ((cols < 60)) && cols=60
  listh=$n
  ((listh > lines - 8)) && listh=$((lines - 8))
  ((listh < 1)) && listh=1
  printf '%s %s %s\n' "$((listh + 8))" "$cols" "$listh"
}

# 单选菜单。$1 标题，$2 提示，其余为 tag、说明 成对给出。
ui_menu() {
  local title=$1 prompt=$2
  shift 2
  if ui_available; then
    local boxh cols listh
    read -r boxh cols listh <<< "$(ui_size $(($# / 2)))"
    whiptail --title "$title" --menu "$prompt" "$boxh" "$cols" "$listh" "$@" 3>&1 1>&2 2>&3
  else
    plain_menu "$prompt" "$@"
  fi
}

# 复选。$1 标题，$2 提示，其余为 tag、说明、状态 三元组。
# --separate-output 让结果一行一个 tag，省得再按引号拆。
ui_checklist() {
  local title=$1 prompt=$2
  shift 2
  if ui_available; then
    local boxh cols listh
    read -r boxh cols listh <<< "$(ui_size $(($# / 3)))"
    whiptail --title "$title" --separate-output --checklist "$prompt" "$boxh" "$cols" "$listh" "$@" 3>&1 1>&2 2>&3
  else
    plain_checklist "$prompt" "$@"
  fi
}

# 单行输入。$1 标题，$2 提示，$3 默认值。
ui_input() {
  local title=$1 prompt=$2 default=${3:-}
  if ui_available; then
    whiptail --title "$title" --inputbox "$prompt" 10 70 "$default" 3>&1 1>&2 2>&3
  else
    printf '%s\n\n' "$prompt" >&2
    printf '直接回车用默认值 [%s]: ' "$default" >&2
    local answer
    read -r answer || return 1
    printf '%s\n' "${answer:-$default}"
  fi
}

# 是/否。默认答否，回车即取消。
ui_yesno() {
  local title=$1 prompt=$2
  if ui_available; then
    whiptail --title "$title" --yesno "$prompt" 12 70 3>&1 1>&2 2>&3
  else
    printf '%s [y/N]: ' "$prompt" >&2
    local answer
    read -r answer || return 1
    [[ "${answer,,}" == y || "${answer,,}" == yes ]]
  fi
}

ui_msg() {
  local title=$1 text=$2
  if ui_available; then
    whiptail --title "$title" --msgbox "$text" 14 70 3>&1 1>&2 2>&3
  else
    info "$text"
  fi
}

# 输出量大时用文本框分页看，内容从文件读。
ui_textbox() {
  local title=$1 file=$2
  if ui_available; then
    # 文本框尺寸给 0 表示自动，但它要的是数字，这里按终端大小算。
    local lines cols
    lines=$(tput lines 2>/dev/null || printf '24')
    cols=$(tput cols 2>/dev/null || printf '100')
    whiptail --title "$title" --scrolltext --textbox "$file" "$lines" "$cols" 3>&1 1>&2 2>&3
  else
    cat "$file" >&2
  fi
}

# 没有 whiptail 或不在终端上时的编号单选。
plain_menu() {
  local prompt=$1
  shift
  local -a tags=() descs=()
  while (($# > 1)); do
    tags+=("$1")
    descs+=("$2")
    shift 2
  done

  printf '%s\n\n' "$prompt" >&2
  local i
  for i in "${!tags[@]}"; do
    printf '  %2d) %-14s %s\n' "$((i + 1))" "${tags[$i]}" "${descs[$i]}" >&2
  done
  printf '\n输入编号，回车确认（直接回车取消）: ' >&2

  local answer
  read -r answer || return 1
  [[ "$answer" =~ ^[0-9]+$ ]] || return 1
  ((answer >= 1 && answer <= ${#tags[@]})) || return 1
  printf '%s\n' "${tags[$((answer - 1))]}"
}

# 编号复选，空格分开多个编号。
plain_checklist() {
  local prompt=$1
  shift
  local -a tags=() descs=()
  while (($# > 2)); do
    tags+=("$1")
    descs+=("$2")
    shift 3
  done

  printf '%s\n\n' "$prompt" >&2
  local i
  for i in "${!tags[@]}"; do
    printf '  %2d) %-14s %s\n' "$((i + 1))" "${tags[$i]}" "${descs[$i]}" >&2
  done
  printf '\n输入编号，空格分开多个（直接回车取消）: ' >&2

  local answer n
  read -r answer || return 1
  [[ -n "$answer" ]] || return 1
  for n in $answer; do
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    ((n >= 1 && n <= ${#tags[@]})) || continue
    printf '%s\n' "${tags[$((n - 1))]}"
  done
}
