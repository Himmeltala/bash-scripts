#!/usr/bin/env bash
# bash-scripts 安装脚本。
#
# 两种跑法都支持：
#   一、从仓库检出里跑：./install.sh
#   二、从 curl 管道里跑：curl -fsSL <install.sh 的地址> | bash
# 第二种情况下没有本地源码，脚本会去下载仓库归档再解开。
#
# 安装后的目录层级与仓库保持一致：
#   ~/.local/share/bash-scripts/
#   └── workflows/
#       └── java-maven/
#           └── bin/
#               └── mvnstart
# 可执行文件软链到 ~/.local/bin。

set -euo pipefail

readonly REPO_SLUG='Himmeltala/bash-scripts'
readonly BRANCH='main'
readonly TARBALL_URL="${BASH_SCRIPTS_TARBALL_URL:-https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/heads/${BRANCH}}"

readonly INSTALL_DIR="${BASH_SCRIPTS_INSTALL_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-scripts}"
readonly BIN_DIR="${BASH_SCRIPTS_BIN_DIR:-$HOME/.local/bin}"

# 要写进 .bashrc 的那一行。链接目录是默认位置时写成 $HOME 形式，
# 换台机器、换个家目录仍然管用；被覆盖成别的路径就写死那个路径。
path_line() {
  if [[ "$BIN_DIR" == "$HOME/.local/bin" ]]; then
    printf 'export PATH="$HOME/.local/bin:$PATH"\n'
  else
    printf 'export PATH="%s:$PATH"\n' "$BIN_DIR"
  fi
}

info() { printf '%s\n' "$*"; }
warn() { printf '警告: %s\n' "$*" >&2; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: install.sh [选项]

把 bash-scripts 装到 ~/.local/share/bash-scripts，可执行文件软链到 ~/.local/bin。

选项:
  -h, --help     显示本帮助

可用环境变量覆盖默认位置:
  BASH_SCRIPTS_INSTALL_DIR   源码安装目录，默认 ${XDG_DATA_HOME:-~/.local/share}/bash-scripts
  BASH_SCRIPTS_BIN_DIR       可执行文件链接目录，默认 ~/.local/bin
  BASH_SCRIPTS_TARBALL_URL   管道安装时下载的归档地址，默认从 GitHub 取 main 分支
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到 $1，先装上再用"
}

# 找出源码在哪里：优先用脚本所在的检出目录，管道进来的话就下载归档。
# 结果写进全局 SRC_DIR；走下载这条路时临时目录记在 DOWNLOAD_TMP 里给调用方清理。
# 这里不能用「函数打印、调用方 command substitution 接」的写法：
# 命令替换会开子 shell，函数里设的 DOWNLOAD_TMP 出不来，临时目录就清不掉了。
SRC_DIR=''
DOWNLOAD_TMP=''

resolve_source() {
  local self=''
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != 'bash' && -f "${BASH_SOURCE[0]}" ]]; then
    self=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  fi

  if [[ -n "$self" && -d "$self/workflows" ]]; then
    info "用本地检出作为来源: $self"
    SRC_DIR=$self
    return 0
  fi

  local tmp
  tmp=$(mktemp -d)
  DOWNLOAD_TMP=$tmp
  info "本地没有源码，从 $TARBALL_URL 下载"

  local archive="$tmp/repo.tar.gz"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$TARBALL_URL" -o "$archive" || die '下载失败，检查网络或归档地址'
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$archive" "$TARBALL_URL" || die '下载失败，检查网络或归档地址'
  else
    die 'curl 与 wget 都没有，装一个再来'
  fi

  need_cmd tar
  tar -xzf "$archive" -C "$tmp" || die '解压失败'
  # 归档解开后是一层 repo-branch 目录，取里面那个
  local extracted
  extracted=$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)
  [[ -n "$extracted" && -d "$extracted/workflows" ]] || die '归档里没找到 workflows 目录'
  SRC_DIR=$extracted
}

# 用 tar 管道复制，顺手排掉 .git，不依赖 rsync。
copy_tree() {
  local src=$1 dst=$2
  mkdir -p "$dst"
  ( cd "$src" && tar --exclude=./.git -cf - . ) | ( cd "$dst" && tar -xf - )
}

install_tree() {
  local src=$1
  if [[ "$src" == "$INSTALL_DIR" ]]; then
    info "源码已经在 $INSTALL_DIR，跳过复制"
    return 0
  fi
  info "安装源码到 $INSTALL_DIR"
  copy_tree "$src" "$INSTALL_DIR"
}

# 把 workflows 下各个 bin 目录里的可执行文件软链到 BIN_DIR。
# 这里只认链接，不解引用，重复执行也不会叠出备份文件。
link_bins() {
  local found=0 f name target stamp
  mkdir -p "$BIN_DIR"
  shopt -s nullglob
  for f in "$INSTALL_DIR"/workflows/*/bin/*; do
    [[ -f "$f" ]] || continue
    name=$(basename "$f")
    target="$BIN_DIR/$name"
    if [[ -L "$target" ]] || [[ ! -e "$target" ]]; then
      ln -sfn "$f" "$target"
      info "  链接 $target -> $f"
      found=$((found + 1))
    else
      # 目标位置已经有一个同名实体文件，先备份，不静默覆盖
      stamp=$(date +%Y%m%d%H%M%S)
      mv "$target" "$target.bak.$stamp"
      warn "$target 已存在实体文件，备份为 $target.bak.$stamp"
      ln -sfn "$f" "$target"
      info "  链接 $target -> $f"
      found=$((found + 1))
    fi
  done
  shopt -u nullglob
  ((found > 0)) || warn "在 $INSTALL_DIR/workflows/*/bin 下没找到可执行文件"
}

# 保证 BIN_DIR 在 PATH 里。已经生效就不重复写，避免 .bashrc 越堆越长。
ensure_path() {
  case ":$PATH:" in
    *":$BIN_DIR:"*)
      return 0
      ;;
  esac

  local rc="$HOME/.bashrc" line
  line=$(path_line)

  if [[ -f "$rc" ]] && grep -qF "$line" "$rc"; then
    info "$rc 里已有 PATH 设置，重开 shell 或 source 一次即可生效"
    return 0
  fi

  info "把 $BIN_DIR 写进 $rc"
  {
    printf '\n# bash-scripts 装的工具\n'
    printf '%s\n' "$line"
  } >> "$rc"
  info "重开 shell 或执行 source $rc 后生效"
}

main() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -h|--help) usage; exit 0 ;;
      *) die "未知选项 $arg，用 install.sh --help 看用法" ;;
    esac
  done

  resolve_source
  [[ -n "$SRC_DIR" ]] || die '没能确定源码位置'

  install_tree "$SRC_DIR"
  link_bins
  ensure_path

  [[ -n "$DOWNLOAD_TMP" ]] && rm -rf "$DOWNLOAD_TMP"

  info ''
  info '装好了。'
  info "源码: $INSTALL_DIR"
  info "入口: $BIN_DIR"
  info '卸载: 用仓库里的 uninstall.sh，clone 过的也可以直接跑 ./uninstall.sh'
  info '      curl -fsSL https://raw.githubusercontent.com/Himmeltala/bash-scripts/main/uninstall.sh | bash'
}

main "$@"
