# 扫描报告：家目录大文件与构建产物目录，只读，不删除任何东西。

SCAN_MIN_FIND='500M'
SCAN_MIN_LABEL='500M'
SCAN_TOP=30
REPORT_PAGED=0

# find 的 -size 不带单位时按 512 字节块算，这里统一补成字节或 k、M、G。
set_min_size() {
  local v=$1 num unit
  [[ $v =~ ^([0-9]+)([kKMG]?)$ ]] || usage_error "尺寸 $v 不合法，写数字加 k、M 或 G"
  num=${BASH_REMATCH[1]}
  unit=${BASH_REMATCH[2]}
  case "$unit" in
    ''|c|C) SCAN_MIN_FIND="${num}c"; SCAN_MIN_LABEL="${num}B" ;;
    k|K) SCAN_MIN_FIND="${num}k"; SCAN_MIN_LABEL="${num}K" ;;
    M) SCAN_MIN_FIND="${num}M"; SCAN_MIN_LABEL="${num}M" ;;
    G) SCAN_MIN_FIND="${num}G"; SCAN_MIN_LABEL="${num}G" ;;
  esac
}

set_top() {
  [[ $1 =~ ^[0-9]+$ ]] || usage_error "条数 $1 不是数字"
  SCAN_TOP=$((10#$1))
  ((SCAN_TOP > 0)) || usage_error '条数要大于 0'
}

scan_big_files() {
  local out=$1
  info '扫描家目录大文件，文件多时会慢'
  {
    printf '# 大文件扫描\n\n'
    printf '范围：%s\n' "$HOME"
    printf '阈值：大于 %s，列出最大的 %s 个文件与最大的 %s 个一级目录。\n\n' \
      "$SCAN_MIN_LABEL" "$SCAN_TOP" "$SCAN_TOP"
    printf '## 最大文件\n\n'
    find "$HOME" -xdev -type f -size +"$SCAN_MIN_FIND" -printf '%s\t%p\n' 2>/dev/null \
      | sort -rn | head -n "$SCAN_TOP" \
      | while IFS=$'\t' read -r size path; do
          printf '%10s  %s\n' "$(format_size "$size")" "$path"
        done
    printf '\n## 最大一级目录\n\n'
    du -x -d 1 -B1 -- "$HOME" 2>/dev/null \
      | awk -F'\t' -v h="$HOME" '$2 != h' \
      | sort -rn | head -n "$SCAN_TOP" \
      | while IFS=$'\t' read -r size path; do
          printf '%10s  %s\n' "$(format_size "$size")" "$path"
        done
  } >"$out"
}

scan_build_artifacts() {
  local out=$1
  info '扫描构建产物，目录多时会慢'
  {
    printf '# 构建产物扫描（只报告）\n\n'
    printf '范围：%s\n' "$HOME"
    printf '列出最大的 %s 个构建产物目录，例如 node_modules、target、build、dist、.venv。\n\n' "$SCAN_TOP"
    find "$HOME" -xdev \
      \( -name .git -o -name .svn \) -prune -o \
      -type d \( -name node_modules -o -name target -o -name build -o -name dist -o -name .venv \) \
      -prune -print0 2>/dev/null \
      | xargs -0 -r du -sb -- 2>/dev/null \
      | sort -rn | head -n "$SCAN_TOP" \
      | while IFS=$'\t' read -r size path; do
          printf '%10s  %s\n' "$(format_size "$size")" "$path"
        done
  } >"$out"
}

# 报告写临时文件，菜单里用文本查看器翻页，命令行直接输出到标准输出。
run_report() {
  local kind=$1 out
  out=$(mktemp "${TMPDIR:-/tmp}/cleanx-report.XXXXXX") || die '建临时文件失败'
  case "$kind" in
    big) scan_big_files "$out" ;;
    build) scan_build_artifacts "$out" ;;
    *) rm -f -- "$out"; usage_error "未知报告类型 $kind" ;;
  esac

  if ui_available && ((REPORT_PAGED)); then
    ui_textbox '扫描报告' "$out"
  else
    cat "$out"
  fi
  rm -f -- "$out"
}
