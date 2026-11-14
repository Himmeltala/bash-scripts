#!/usr/bin/env bash
# bash-scripts 安装脚本，支持本地检出运行与 curl 管道运行，后者先下载归档再解开。
# 重复执行等价于先卸载再安装；安装目录是仓库镜像，可执行文件软链到 ~/.local/bin。

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

# /etc/environment 里已经把某个目录写进 PATH。这里不展开变量，只认字面路径。
environment_covered() {
  local file="$ENVIRONMENT_PATH"
  [[ -f "$file" && -r "$file" ]] || return 1
  awk -v dir="$BIN_DIR" '
    /^PATH=/ {
      value = $0
      # 整个值外面套着一对双引号时先剥掉，否则首尾两段会带上引号。
      if (value ~ /^PATH=".*"$/) value = substr(value, 7, length(value) - 7)
      else sub(/^PATH=/, "", value)
      n = split(value, parts, ":")
      for (i = 1; i <= n; i++) {
        if (parts[i] == dir) found = 1
      }
    }
    END { exit !found }
  ' "$file"
}

# 要写进 .bashrc 的 PATH 行：默认位置写成 $HOME 形式，自定义路径写死。
# 带幂等判断：login shell 已经通过 ~/.profile 拿到该目录时，这里不再追加一次。
path_line() {
  local dir
  if [[ "$BIN_DIR" == "$HOME/.local/bin" ]]; then
    dir='$HOME/.local/bin'
  else
    dir=$BIN_DIR
  fi
  printf '[[ ":$PATH:" == *":%s:"* ]] || export PATH="%s:$PATH"\n' "$dir" "$dir"
}

info() { printf '%s\n' "$*"; }
warn() { printf '警告: %s\n' "$*" >&2; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: install.sh [选项]

装 bash-scripts 到 ~/.local/share/bash-scripts，可执行文件软链到 ~/.local/bin。

重复执行等于先卸载再重装；安装目录是仓库镜像，不要直接改。

选项:
  -h, --help     显示本帮助

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

# 用 tar 管道复制，排除 .git 与前端依赖目录，不依赖 rsync。
# 收方先删掉旧目录：重复执行时源码目录可能原样在安装位置上，--exclude 管不到收方已有的文件。
copy_tree() {
  local src=$1 dst=$2
  ( cd "$src" && tar --exclude=./.git --exclude=./node_modules --exclude='*/node_modules' -cf - . ) |
    ( rm -rf "$dst" && mkdir -p "$dst" && cd "$dst" && tar -xf - )
}

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

install_tree() {
  local src=$1
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

# 清 .bashrc 的 PATH 设置，连同标记行前旧版遗留的空行。uninstall.sh 有同样一份。
remove_path_setting() {
  local rc="$HOME/.bashrc"
  if [[ ! -f "$rc" ]] || ! grep -qF "$MARK_LINE" "$rc"; then
    return 0
  fi

  info "  从 $rc 摘掉上一次写的 PATH 设置"
  local tmp
  tmp=$(mktemp)
  awk -v mark="$MARK_LINE" '
    { line[NR] = $0 }
    END {
      skip_next = 0
      for (i = 1; i <= NR; i++) {
        if (skip_next) { skip_next = 0; continue }
        if (line[i] == mark) {
          while (n > 0 && out[n] ~ /^[[:space:]]*$/) n--
          if (i < NR && line[i + 1] ~ /^(\[\[|export PATH=)/) skip_next = 1
          continue
        }
        out[++n] = line[i]
      }
      for (i = 1; i <= n; i++) print out[i]
    }
  ' "$rc" > "$tmp"
  cat "$tmp" > "$rc"
  rm -f "$tmp"
}

# 装前清掉旧软链、旧安装目录与 PATH 设置；管道安装没有 uninstall.sh，故在此重复实现。
clean_previous() {
  if [[ -d "$INSTALL_DIR" ]]; then
    # 安装目录可由环境变量指到别处，删前先确认里面确实是本项目的东西，否则 rm -rf 会误删无关目录。
    if [[ "$(basename "$INSTALL_DIR")" != 'bash-scripts' ]] && ! has_bin_dirs "$INSTALL_DIR"; then
      die "$INSTALL_DIR 不像本项目安装目录（名字不是 bash-scripts、无 */bin 目录），确认路径"
    fi
    remove_links
    info "清除上一次装的目录 $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi
  remove_path_setting
}

# 把各工具 bin 下的可执行文件软链到 BIN_DIR，不解引用，重复执行不会叠出备份文件。
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

# 看 .bashrc 判断是否已有设置，不看当前 PATH：旧设置刚清掉时当前 shell 仍是旧值。
ensure_path() {
  local rc="$HOME/.bashrc" line
  line=$(path_line)

  if [[ -f "$rc" ]] && grep -qF "$line" "$rc"; then
    info "$rc 里已有 PATH 设置，重开 shell 或 source 一次即可生效"
    return 0
  fi

  # /etc/environment 对所有会话生效，已覆盖时不再往 .bashrc 里加。
  if environment_covered; then
    info "$BIN_DIR 已由 $ENVIRONMENT_FILE 加进 PATH，不写 $rc"
    return 0
  fi

  info "把 $BIN_DIR 写进 $rc"
  # 空文件不加前导空行；非空时留一个空行，也补上末尾缺的换行。
  {
    [[ -s "$rc" ]] && printf '\n'
    printf '%s\n' "$MARK_LINE"
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
  resolve_bash_tui

  clean_previous
  install_tree "$SRC_DIR"
  install_bash_tui
  link_bins
  ensure_path

  [[ -n "$DOWNLOAD_TMP" ]] && rm -rf "$DOWNLOAD_TMP"
  [[ -n "$BASH_TUI_DOWNLOAD_TMP" ]] && rm -rf "$BASH_TUI_DOWNLOAD_TMP"

  info ''
  info '装好了。'
  info "源码: $INSTALL_DIR"
  info "入口: $BIN_DIR"
  info '卸载: clone 过的直接跑 ./uninstall.sh，没 clone 的用下面这条'
  info "      curl -fsSL ${UNINSTALL_URL} | bash"
}

main "$@"
