# @Author: Himmeltala
# @Date: 2026-11-28 21:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 21:10:00
# @FilePath: \install\lib/web.sh
# @Description: 前端依赖安装与构建：锁文件对不上就重装，再逐个构建。

# node_modules 与锁文件对不上就重装：装完把锁文件另存一份进 node_modules，下次比对。
# npm 自己写的 .package-lock.json 会省掉根条目，不能直接拿来比。
ensure_deps() {
  local dir=$1
  if [[ -d "$dir/node_modules" ]] && cmp -s "$dir/package-lock.json" "$dir/node_modules/.idex-lock.json"; then
    return 0
  fi
  info "安装 $dir 的前端依赖"
  ( cd "$dir" && npm ci --no-audit --no-fund ) || die "安装 $dir 的前端依赖失败"
  cp "$dir/package-lock.json" "$dir/node_modules/.idex-lock.json"
}

# 前端产物不入库，安装时按当前源码重建：文件名不带哈希，重新打包只改同名文件；
# 浏览器端由服务端的 no-cache 保证拿到新版本。
build_web() {
  local dir
  need_cmd node
  need_cmd npm
  for dir in lib/web-shared llmx/web idex/web netx/web; do
    [[ -d "$SRC_DIR/$dir" ]] || continue
    ensure_deps "$SRC_DIR/$dir"
    info "构建 $dir"
    ( cd "$SRC_DIR/$dir" && npm run build ) || die "构建 $dir 失败"
  done
}

