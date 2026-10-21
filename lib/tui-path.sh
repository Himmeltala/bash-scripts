# 定位并加载 bash-tui：BASH_TUI_DIR、同级检出、安装目录 vendor 依次尝试。

_tui_path_root=${BASH_SOURCE[0]%/*}
[[ "$_tui_path_root" == "${BASH_SOURCE[0]}" ]] && _tui_path_root='.'
_tui_path_root=$(cd "$_tui_path_root/.." && pwd)

_tui_path_candidates=(
  "${BASH_TUI_DIR:-}"
  "$_tui_path_root/../bash-tui"
  "$_tui_path_root/vendor/bash-tui"
)

_tui_path_found=''
for _tui_path_candidate in "${_tui_path_candidates[@]}"; do
  [[ -n "$_tui_path_candidate" ]] || continue
  if [[ -f "$_tui_path_candidate/bash-tui.sh" ]]; then
    _tui_path_found=$_tui_path_candidate
    break
  fi
done

if [[ -z "$_tui_path_found" ]]; then
  printf 'bash-tui: 找不到 bash-tui.sh，已查找:\n' >&2
  for _tui_path_candidate in "${_tui_path_candidates[@]}"; do
    [[ -n "$_tui_path_candidate" ]] && printf '  %s\n' "$_tui_path_candidate" >&2
  done
  unset _tui_path_root _tui_path_candidates _tui_path_candidate _tui_path_found
  return 1
fi

BASH_TUI_DIR=$(cd "$_tui_path_found" && pwd)
# shellcheck source=/dev/null
if ! source "$BASH_TUI_DIR/bash-tui.sh"; then
  unset _tui_path_root _tui_path_candidates _tui_path_candidate _tui_path_found
  return 1
fi

unset _tui_path_root _tui_path_candidates _tui_path_candidate _tui_path_found
return 0
