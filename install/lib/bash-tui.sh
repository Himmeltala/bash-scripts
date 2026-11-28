# @Author: Himmeltala
# @Date: 2026-11-28 21:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 21:10:00
# @FilePath: \install\lib/bash-tui.sh
# @Description: bash-tui 的版本定位、下载与安装。

BASH_TUI_SRC_DIR=''
BASH_TUI_REF_RESOLVED=''
BASH_TUI_DOWNLOAD_TMP=''

# 结果写 BASH_TUI_SRC_DIR。
resolve_bash_tui() {
  local ref="${BASH_TUI_REF:-}"
  if [[ -z "$ref" ]]; then
    if [[ ! -f "$SRC_DIR/$BASH_TUI_REF_FILE" ]]; then
      die "缺少 $SRC_DIR/$BASH_TUI_REF_FILE，无法确定 bash-tui 版本"
    fi
    ref=$(tr -d '[:space:]' < "$SRC_DIR/$BASH_TUI_REF_FILE")
  fi
  [[ -n "$ref" ]] || die "$BASH_TUI_REF_FILE 内容为空"
  BASH_TUI_REF_RESOLVED=$ref

  if [[ -n "${BASH_TUI_SRC:-}" ]]; then
    [[ -f "$BASH_TUI_SRC/bash-tui.sh" ]] || die "BASH_TUI_SRC 下没有 bash-tui.sh: $BASH_TUI_SRC"
    BASH_TUI_SRC_DIR=$BASH_TUI_SRC
    info "用 BASH_TUI_SRC 指定的 bash-tui 来源: $BASH_TUI_SRC"
    return 0
  fi

  local sibling
  sibling="$(cd "$SRC_DIR/.." && pwd)/bash-tui"
  if [[ -f "$sibling/bash-tui.sh" ]]; then
    BASH_TUI_SRC_DIR=$sibling
    info "用同级检出作为 bash-tui 来源: $sibling"
    return 0
  fi

  local url="${BASH_TUI_TARBALL_URL:-https://codeload.github.com/${BASH_TUI_SLUG}/tar.gz/refs/tags/${ref}}"
  local tmp archive extracted
  tmp=$(mktemp -d)
  BASH_TUI_DOWNLOAD_TMP=$tmp
  info "从 $url 下载 bash-tui $ref"

  archive="$tmp/bash-tui.tar.gz"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$archive" || die "下载 bash-tui $ref 失败，检查标签与地址"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$archive" "$url" || die "下载 bash-tui $ref 失败，检查标签与地址"
  else
    die 'curl 与 wget 都没有，装一个再来'
  fi

  need_cmd tar
  tar -xzf "$archive" -C "$tmp" || die '解压 bash-tui 归档失败'
  extracted=$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)
  [[ -n "$extracted" && -f "$extracted/bash-tui.sh" ]] || die 'bash-tui 归档里没有 bash-tui.sh'
  BASH_TUI_SRC_DIR=$extracted
}

install_bash_tui() {
  local dest="$INSTALL_DIR/vendor/bash-tui"
  info "安装 bash-tui $BASH_TUI_REF_RESOLVED 到 $dest"
  copy_tree "$BASH_TUI_SRC_DIR" "$dest"
}

