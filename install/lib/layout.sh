# @Author: Himmeltala
# @Date: 2026-11-28 21:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 21:10:00
# @FilePath: \install\lib/layout.sh
# @Description: 安装布局：源码复制、旧版本清理、软链与 PATH 设置。

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

