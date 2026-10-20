# 界面层：自绘菜单、复选、输入、确认与文本查看，以及探不到终端时的编号输入。

# 单选菜单。$1 标题，$2 提示，其余为标签与说明，成对给出。
ui_menu() {
  local title=$1 prompt=$2
  shift 2
  if ui_available; then
    tui_select menu "$title" "$prompt" "$@"
  else
    plain_menu "$prompt" "$@"
  fi
}

# 复选：参数为标签、说明、状态三元组，状态为 ON 时预先勾选。
ui_checklist() {
  local title=$1 prompt=$2
  shift 2
  if ! ui_available; then
    plain_checklist "$prompt" "$@"
    return $?
  fi

  local -a items=() selected=()
  local rc=0 out
  while (($# >= 3)); do
    items+=("$1" "$2")
    [[ "$3" == ON ]] && selected+=("$1")
    shift 3
  done

  local TUI_PRESELECT=''
  ((${#selected[@]})) && TUI_PRESELECT=$(printf '%s\n' "${selected[@]}")
  out=$(tui_select checklist "$title" "$prompt" "${items[@]}") || rc=$?
  ((rc == 2)) && return 0
  ((rc == 0)) || return "$rc"
  printf '%s\n' "$out"
}

# 单行输入。$1 标题，$2 提示，$3 默认值。
ui_input() {
  local title=$1 prompt=$2 default=${3:-}
  if ui_available; then
    tui_input "$title" "$prompt" "$default"
    return $?
  fi
  printf '%s\n\n' "$prompt" >&2
  printf '默认 [%s]: ' "$default" >&2
  local answer
  read -r answer || return 1
  printf '%s\n' "${answer:-$default}"
}

# 是/否。默认答否，回车即取消。
ui_yesno() {
  local title=$1 prompt=$2
  if ui_available; then
    tui_confirm "$title" "$prompt"
    return $?
  fi
  printf '%s [y/N]: ' "$prompt" >&2
  local answer
  read -r answer || return 1
  [[ "${answer,,}" == y || "${answer,,}" == yes ]]
}

# 输出量大时用文本框分页看，内容从文件读。
ui_textbox() {
  local title=$1 file=$2
  if ui_available; then
    tui_textbox "$title" "$file"
  else
    cat "$file" >&2
  fi
}

# 没有终端时使用编号输入。
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
  printf '\n编号（回车取消）: ' >&2

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
  printf '\n编号，空格分隔（回车取消）: ' >&2

  local answer n
  read -r answer || return 1
  [[ -n "$answer" ]] || return 1
  for n in $answer; do
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    ((n >= 1 && n <= ${#tags[@]})) || continue
    printf '%s\n' "${tags[$((n - 1))]}"
  done
}
