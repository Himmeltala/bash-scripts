# @Author: Himmeltala
# @Date: 2026-11-28 21:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 21:10:00
# @FilePath: \install\lib/common.sh
# @Description: 安装脚本共用件：目录复制与下载临时目录清理。

# 用 tar 管道复制，排除 .git 与前端依赖目录，不依赖 rsync。
# 收方先删掉旧目录：重复执行时源码目录可能原样在安装位置上，--exclude 管不到收方已有的文件。
copy_tree() {
  local src=$1 dst=$2
  ( cd "$src" && tar --exclude=./.git --exclude=./node_modules --exclude='*/node_modules' -cf - . ) |
    ( rm -rf "$dst" && mkdir -p "$dst" && cd "$dst" && tar -xf - )
}


cleanup_download() {
  if [[ -n "${DOWNLOAD_TMP:-}" ]]; then
    rm -rf "$DOWNLOAD_TMP"
    DOWNLOAD_TMP=''
  fi
}
