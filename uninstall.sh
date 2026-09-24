#!/usr/bin/env bash
# bash-scripts 卸载脚本。
#
# 默认只清掉自己装进去的东西：软链、源码目录、以及带着「bash-scripts 装的工具」
# 标记的那段 PATH 设置。链接目录里不是指向本项目的文件一律不动。
#
# 用法:
#   ./uninstall.sh              删软链、删源码目录、清 PATH 设置
#   ./uninstall.sh --keep-path  保留 ~/.bashrc 里的 PATH 设置
#   ./uninstall.sh --dry-run    只打印要做什么，不动盘

set -euo pipefail

readonly INSTALL_DIR="${BASH_SCRIPTS_INSTALL_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-scripts}"
readonly BIN_DIR="${BASH_SCRIPTS_BIN_DIR:-$HOME/.local/bin}"
readonly RC_FILE="$HOME/.bashrc"
readonly MARK_LINE='# bash-scripts 装的工具'

DRY_RUN=0
KEEP_PATH=0

info() { printf '%s\n' "$*"; }
warn() { printf '警告: %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
用法: uninstall.sh [选项]

选项:
  -n, --dry-run    只打印将要做什么，不实际删除
      --keep-path  保留 ~/.bashrc 里的 PATH 设置
  -h, --help       显示本帮助

可用环境变量覆盖位置，与 install.sh 保持一致:
  BASH_SCRIPTS_INSTALL_DIR   源码安装目录
  BASH_SCRIPTS_BIN_DIR       可执行文件链接目录
EOF
}

run() {
  if ((DRY_RUN)); then
    printf '  [预演] %s\n' "$*"
  else
    "$@"
  fi
}

# 只删指向本项目源码目录的软链。链接目录里别人的东西不碰。
remove_links() {
  local link target removed=0
  shopt -s nullglob
  for link in "$BIN_DIR"/*; do
    [[ -L "$link" ]] || continue
    target=$(readlink "$link") || continue
    case "$target" in
      "$INSTALL_DIR"/*)
        info "  删软链 $link"
        run rm -f "$link"
        removed=$((removed + 1))
        ;;
    esac
  done
  shopt -u nullglob
  ((removed > 0)) || info '  没有指向本项目的软链'
}

remove_install_dir() {
  if [[ -d "$INSTALL_DIR" ]]; then
    info "  删源码目录 $INSTALL_DIR"
    run rm -rf "$INSTALL_DIR"
  else
    info "  源码目录 $INSTALL_DIR 不在，跳过"
  fi
}

# 清掉安装时写进 .bashrc 的那两行。
# 只认自己写的标记行，标记行后面那一行无论内容是什么一并删掉，
# 这样链接目录被覆盖成别的路径时也能清干净，同时不会误删用户手写的 PATH 设置。
remove_path_setting() {
  if [[ ! -f "$RC_FILE" ]]; then
    info "  $RC_FILE 不在，跳过"
    return 0
  fi
  if ! grep -qF "$MARK_LINE" "$RC_FILE"; then
    info "  $RC_FILE 里没有本项目的 PATH 设置，跳过"
    return 0
  fi

  info "  从 $RC_FILE 摘掉 PATH 设置"
  if ((DRY_RUN)); then
    printf '  [预演] 删除标记行 %s 及其后一行\n' "$MARK_LINE"
    return 0
  fi

  local tmp
  tmp=$(mktemp)
  awk -v mark="$MARK_LINE" '
    $0 == mark { skip = 2 }
    skip > 0 { skip--; next }
    { print }
  ' "$RC_FILE" > "$tmp"
  cat "$tmp" > "$RC_FILE"
  rm -f "$tmp"
}

main() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -h|--help) usage; exit 0 ;;
      -n|--dry-run) DRY_RUN=1 ;;
      --keep-path) KEEP_PATH=1 ;;
      *) warn "未知选项 $arg，忽略" ;;
    esac
  done

  ((DRY_RUN)) && info '预演模式，不会真的删东西'
  info "卸载 bash-scripts"
  info "  源码目录: $INSTALL_DIR"
  info "  链接目录: $BIN_DIR"

  remove_links
  remove_install_dir
  if ((KEEP_PATH)); then
    info '  按要求保留 PATH 设置'
  else
    remove_path_setting
  fi

  info ''
  if ((DRY_RUN)); then
    info '预演结束。去掉 --dry-run 才会真的删。'
  else
    info '卸干净了。重开 shell 后 PATH 里不再有这些命令。'
  fi
}

main "$@"
