#!/usr/bin/env bash
# @Author: Himmeltala
# @Date: 2026-11-28 21:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 21:10:00
# @FilePath: \install.sh
# @Description: 安装入口：参数解析与流程编排，具体步骤在 install/lib/。

set -euo pipefail

readonly REPO_SLUG='Himmeltala/bash-scripts'
readonly BRANCH='main'
readonly BASH_TUI_SLUG="${BASH_TUI_SLUG:-Himmeltala/bash-tui}"
readonly BASH_TUI_REF_FILE='bash-tui.ref'
readonly TARBALL_URL="${BASH_SCRIPTS_TARBALL_URL:-https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/heads/${BRANCH}}"

# 卸载脚本地址，只用来在结尾提示；走 jsDelivr 是因为 raw.githubusercontent.com 国内直连常超时。
readonly UNINSTALL_URL="https://cdn.jsdelivr.net/gh/${REPO_SLUG}@${BRANCH}/uninstall.sh"

# 写进 .bashrc 的标记行，安装与卸载共用。
readonly MARK_LINE='# bash-scripts 装的工具'

readonly INSTALL_DIR="${BASH_SCRIPTS_INSTALL_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-scripts}"
readonly BIN_DIR="${BASH_SCRIPTS_BIN_DIR:-$HOME/.local/bin}"

# /etc/environment 由 PAM 在会话开始时读，覆盖到非 login shell，里面已有链接目录时不写 .bashrc。
# ~/.profile 不算覆盖：终端、tmux、IDE 起的常是非 login shell，根本不读它，写了工具照样找不到。
readonly ENVIRONMENT_FILE='/etc/environment'
# 核对 /etc/environment 用哪个文件，可以换掉，测试用。
readonly ENVIRONMENT_PATH="${BASH_SCRIPTS_ENVIRONMENT:-$ENVIRONMENT_FILE}"

# 引导函数：下载源码前就要用，不能放 install/lib（管道安装时本地还没有那几个文件）。
info() { printf '%s\n' "$*"; }
warn() { printf '警告: %s\n' "$*" >&2; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: install.sh [选项]

装 bash-scripts 到 ~/.local/share/bash-scripts，可执行文件软链到 ~/.local/bin。

重复执行等于先卸载再重装；安装目录是仓库镜像，不要直接改。

选项:
  -h, --help          显示本帮助
  --list-deps         列出可选依赖
  --deps 名字         只安装可选依赖，不安装工具；多个用逗号，all 为全部

可用环境变量覆盖默认位置:
  BASH_SCRIPTS_INSTALL_DIR   源码安装目录，默认 ${XDG_DATA_HOME:-~/.local/share}/bash-scripts
  BASH_SCRIPTS_BIN_DIR       可执行文件链接目录，默认 ~/.local/bin
  BASH_SCRIPTS_TARBALL_URL   管道安装时下载的归档地址，默认从 GitHub 取 main 分支
  BASH_SCRIPTS_ENVIRONMENT   核对 PATH 用的系统配置文件，默认 /etc/environment
  BASH_TUI_REF               覆盖 bash-tui 标签，默认读 bash-tui.ref
  BASH_TUI_TARBALL_URL       覆盖 bash-tui 归档地址
  BASH_TUI_SRC               指定本地 bash-tui 源码目录
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到 $1，先安装"
}

# 目录下有 */bin 才算源码树。
has_bin_dirs() {
  local d
  for d in "$1"/*/bin; do
    [[ -d "$d" ]] && return 0
  done
  return 1
}

# 找源码并写入 SRC_DIR；下载的临时目录记入 DOWNLOAD_TMP，供收尾清理。
# 不用命令替换返回：子 shell 里的 DOWNLOAD_TMP 传不出来。
SRC_DIR=''
DOWNLOAD_TMP=''

resolve_source() {
  local self=''
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != 'bash' && -f "${BASH_SOURCE[0]}" ]]; then
    self=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  fi

  if [[ -n "$self" && -d "$self" ]] && has_bin_dirs "$self"; then
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
  # 归档解开后只有一层 repo-branch 目录，取其中唯一的目录
  local extracted
  extracted=$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)
  [[ -n "$extracted" ]] && has_bin_dirs "$extracted" || die '归档里没找到任何 */bin 目录'
  SRC_DIR=$extracted
}


# 功能在 install/lib 下，按单一职责拆开；下载源码前只用本文件里的引导函数。
source_install_libs() {
  local lib
  for lib in common bash-tui web layout deps; do
    # shellcheck source=/dev/null
    source "$SRC_DIR/install/lib/$lib.sh" || die "加载 install/lib/$lib.sh 失败"
  done
}

main() {
  local deps='' deps_flag=0 list_only=0
  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      --list-deps) list_only=1; shift ;;
      --deps)
        (($# >= 2)) || die '--deps 后面要跟依赖名'
        deps=$2
        deps_flag=1
        shift 2
        ;;
      --deps=*)
        deps=${1#*=}
        deps_flag=1
        shift
        ;;
      *) die "未知选项 $1，用 install.sh --help 看用法" ;;
    esac
  done

  resolve_source
  [[ -n "$SRC_DIR" ]] || die '没能确定源码位置'
  source_install_libs

  if ((list_only)); then
    info '可选依赖:'
    list_deps
    cleanup_download
    exit 0
  fi
  if ((deps_flag)); then
    [[ -n "${deps//[[:space:]]/}" ]] || die '--deps 后面要跟依赖名'
    install_deps "$deps"
    cleanup_download
    exit 0
  fi

  resolve_bash_tui
  build_web

  clean_previous
  install_tree "$SRC_DIR"
  install_bash_tui
  link_bins
  ensure_path

  cleanup_download
  if [[ -n "${BASH_TUI_DOWNLOAD_TMP:-}" ]]; then
    rm -rf "$BASH_TUI_DOWNLOAD_TMP"
  fi

  info ''
  info '装好了。'
  info "源码: $INSTALL_DIR"
  info "入口: $BIN_DIR"
  info '卸载: clone 过的直接跑 ./uninstall.sh，没 clone 的用下面这条'
  info "      curl -fsSL ${UNINSTALL_URL} | bash"
}

main "$@"
