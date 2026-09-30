#!/usr/bin/env bash
# bash-scripts 安装脚本。
#
# 两种跑法都支持：
#   一、从仓库检出里跑：./install.sh
#   二、从 curl 管道里跑：curl -fsSL <install.sh 的地址> | bash
# 第二种情况下没有本地源码，脚本会去下载仓库归档再解开。
#
# 重复执行等价于「先卸载再安装」：先把上一次装的清掉（旧软链、旧安装目录、
# .bashrc 里那段 PATH 设置），再拷新的。安装目录是仓库的镜像，不要在那边直接改。
#
# 安装后的目录层级与仓库保持一致：仓库根下每个目录就是一个工具，目录名与命令名
# 一致，各自的 bin 里放可执行文件，lib 里放入口共用的库。
#   ~/.local/share/bash-scripts/
#   ├── mvnx/
#   │   ├── bin/
#   │   │   └── mvnx
#   │   └── lib/
#   │       ├── mvnx-core.sh
#   │       └── mvnx/
#   └── killport/
#       └── bin/
#           └── killport
# 可执行文件软链到 ~/.local/bin；lib 下是入口共用的库，不链。

set -euo pipefail

readonly REPO_SLUG='Himmeltala/bash-scripts'
readonly BRANCH='main'
readonly TARBALL_URL="${BASH_SCRIPTS_TARBALL_URL:-https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/heads/${BRANCH}}"

# 卸载脚本的地址，只用来在结尾提示用户。
# 走 jsDelivr 而不是 raw.githubusercontent.com：后者在国内多数网络下直连超时。
readonly UNINSTALL_URL="https://cdn.jsdelivr.net/gh/${REPO_SLUG}@${BRANCH}/uninstall.sh"

# 写进 .bashrc 的标记行。清旧设置与写新设置都认它，改动时两边一致。
readonly MARK_LINE='# bash-scripts 装的工具'

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

重复执行等价于先卸载再安装：会先清掉上一次装的软链、安装目录与 .bashrc 里的
PATH 设置，再重新装一遍。安装目录是仓库的镜像，不要在那边直接改。

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

# 一个目录像个源码树，判据是它底下有工具目录带 bin。
# 用来区分「脚本就在检出里」与「脚本是管道进来的、源码要去下载」。
has_bin_dirs() {
  local d
  for d in "$1"/*/bin; do
    [[ -d "$d" ]] && return 0
  done
  return 1
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
  # 归档解开后是一层 repo-branch 目录，取里面那个
  local extracted
  extracted=$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)
  [[ -n "$extracted" ]] && has_bin_dirs "$extracted" || die '归档里没找到任何 */bin 目录'
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

# 删掉链接目录里指向本项目安装目录的软链。链接目录里别人的东西一律不碰。
remove_links() {
  local link target removed=0
  shopt -s nullglob
  for link in "$BIN_DIR"/*; do
    [[ -L "$link" ]] || continue
    target=$(readlink "$link") || continue
    case "$target" in
      "$INSTALL_DIR"/*)
        info "  删旧软链 $link"
        rm -f "$link"
        removed=$((removed + 1))
        ;;
    esac
  done
  shopt -u nullglob
  ((removed > 0)) || info '  没有指向本项目的旧软链'
}

# 清掉安装时写进 .bashrc 的那段 PATH 设置。
# 只认自己写的标记行，标记行后面那一行无论内容是什么一并删掉，
# 这样链接目录被覆盖成别的路径时也能清干净，同时不会误删用户手写的设置。
remove_path_setting() {
  local rc="$HOME/.bashrc"
  if [[ ! -f "$rc" ]] || ! grep -qF "$MARK_LINE" "$rc"; then
    return 0
  fi

  info "  从 $rc 摘掉上一次写的 PATH 设置"
  local tmp
  tmp=$(mktemp)
  awk -v mark="$MARK_LINE" '
    $0 == mark { skip = 2 }
    skip > 0 { skip--; next }
    { print }
  ' "$rc" > "$tmp"
  cat "$tmp" > "$rc"
  rm -f "$tmp"
}

# 装之前先把上一次装的清干净：旧软链、旧安装目录、.bashrc 里那段 PATH 设置。
# 与 uninstall.sh 做的是同一件事（那边多一个 --keep-path 与预演开关），放在这里
# 是因为管道安装时本地根本没有 uninstall.sh，装完再装也不该靠另一个脚本。
# 不清的后果很具体：改名或换目录结构之后，安装目录里会留着上一版的整个目录树，
# 链接目录里会留下指向已删路径的死链。
clean_previous() {
  if [[ -d "$INSTALL_DIR" ]]; then
    # 安装目录可以由环境变量指到别处，删之前先确认里面装的确实是本项目的东西，
    # 否则一次 rm -rf 会把无关目录整个删掉。
    if [[ "$(basename "$INSTALL_DIR")" != 'bash-scripts' ]] && ! has_bin_dirs "$INSTALL_DIR"; then
      die "$INSTALL_DIR 看着不是本项目的安装目录（名字不是 bash-scripts，里面也没有带 bin 的工具目录），确认路径没问题再装"
    fi
    remove_links
    info "清除上一次装的目录 $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi
  remove_path_setting
}

# 把各工具目录下 bin 里的可执行文件软链到 BIN_DIR。
# 这里只认链接，不解引用，重复执行也不会叠出备份文件。
link_bins() {
  local found=0 f name target stamp
  mkdir -p "$BIN_DIR"
  shopt -s nullglob
  for f in "$INSTALL_DIR"/*/bin/*; do
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
  ((found > 0)) || warn "在 $INSTALL_DIR/*/bin 下没找到可执行文件"
}

# 保证 .bashrc 里有 BIN_DIR 的 PATH 设置，已经有就不重复写，免得越堆越长。
# 判据看 .bashrc 里有没有那一行，不看当前 PATH：本次安装刚把旧设置清掉，
# 而当前 shell 的 PATH 里还留着旧值，照 PATH 判断会以为不必写，
# 重开 shell 后 PATH 设置就真没了。
ensure_path() {
  local rc="$HOME/.bashrc" line
  line=$(path_line)

  if [[ -f "$rc" ]] && grep -qF "$line" "$rc"; then
    info "$rc 里已有 PATH 设置，重开 shell 或 source 一次即可生效"
    return 0
  fi

  info "把 $BIN_DIR 写进 $rc"
  {
    printf '\n%s\n' "$MARK_LINE"
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

  clean_previous
  install_tree "$SRC_DIR"
  link_bins
  ensure_path

  [[ -n "$DOWNLOAD_TMP" ]] && rm -rf "$DOWNLOAD_TMP"

  info ''
  info '装好了。'
  info "源码: $INSTALL_DIR"
  info "入口: $BIN_DIR"
  info '卸载: clone 过的直接跑 ./uninstall.sh，没 clone 的用下面这条'
  info "      curl -fsSL ${UNINSTALL_URL} | bash"
}

main "$@"
