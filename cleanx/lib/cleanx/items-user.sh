# 用户缓存与回收站。

register_item user.thumbnails user '缩略图缓存' \
  '文件管理器生成的缩略图，删除后按需重建' \
  path "$HOME/.cache/thumbnails" '' 0 1

register_item user.fontconfig user '字体缓存' \
  '字体索引缓存，下次使用字体时重建' \
  path "$HOME/.cache/fontconfig" '' 0 1

register_item user.browser user '浏览器缓存' \
  'Firefox 与 Chrome 系的网页缓存，建议先关闭浏览器；默认不勾选' \
  path "$HOME/.cache/mozilla
$HOME/.cache/google-chrome
$HOME/.cache/chromium
$HOME/.cache/BraveSoftware" '' 0 0

trash_exists() {
  [[ -d "$HOME/.local/share/Trash/files" || -d "$HOME/.local/share/Trash/info" ]]
}

measure_trash() {
  local sub size total=0 existing=0
  for sub in files info; do
    [[ -d "$HOME/.local/share/Trash/$sub" ]] || continue
    existing=1
    size=$(du -sb -- "$HOME/.local/share/Trash/$sub" 2>/dev/null | awk '{print $1}')
    [[ -n $size ]] || continue
    total=$((total + size))
  done
  ((existing)) || return 1
  printf '%s\n' "$total"
}

# 文件与 .trashinfo 一起清，留下任何一个都会让回收站显示不一致。
clean_trash() {
  local sub rc=0
  for sub in files info; do
    [[ -d "$HOME/.local/share/Trash/$sub" ]] || continue
    run_cmd find "$HOME/.local/share/Trash/$sub" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + || rc=1
  done
  return "$rc"
}

register_item user.trash user '回收站' \
  '清空回收站，文件与 .trashinfo 一并删除，无法恢复' \
  func clean_trash measure_trash 0 1 trash_exists
