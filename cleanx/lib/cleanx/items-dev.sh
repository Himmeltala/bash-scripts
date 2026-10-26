# 开发缓存：包管理器、IDE 与 Docker；构建产物只扫描，不在这里删。

register_item dev.maven dev 'Maven 仓库缓存' \
  '~/.m2/repository，删除后构建时重新下载依赖' \
  path "$HOME/.m2/repository" '' 0 1

register_item dev.gradle dev 'Gradle 缓存' \
  '~/.gradle/caches，删除后构建时重新下载依赖' \
  path "$HOME/.gradle/caches" '' 0 1

register_item dev.npm dev 'npm 缓存' \
  '~/.npm/_cacache，删除后安装时重新下载' \
  path "$HOME/.npm/_cacache" '' 0 1

register_item dev.yarn dev 'Yarn 缓存' \
  '~/.cache/yarn，删除后安装时重新下载' \
  path "$HOME/.cache/yarn" '' 0 1

register_item dev.pnpm dev 'pnpm 存储' \
  '~/.local/share/pnpm/store，删除后安装时重新下载' \
  path "$HOME/.local/share/pnpm/store" '' 0 1

register_item dev.pip dev 'pip 缓存' \
  '~/.cache/pip，删除后安装时重新下载' \
  path "$HOME/.cache/pip" '' 0 1

register_item dev.go dev 'Go 缓存' \
  '构建缓存与模块下载缓存，删除后构建时重新下载' \
  path "$HOME/.cache/go-build
$HOME/go/pkg/mod" '' 0 1

register_item dev.cargo dev 'Cargo 注册表缓存' \
  '~/.cargo/registry 下的下载缓存与解包源码，删除后构建时重新下载' \
  path "$HOME/.cargo/registry/cache
$HOME/.cargo/registry/src" '' 0 1

register_item dev.ide dev 'IDE 缓存' \
  'JetBrains 与 VS Code 的索引、日志缓存，建议先关闭 IDE；默认不勾选' \
  path "$HOME/.cache/JetBrains
$HOME/.config/Code/Cache
$HOME/.config/Code/CachedData
$HOME/.config/Code/CachedExtensionVSIXs
$HOME/.config/Code/GPUCache
$HOME/.config/Code/logs" '' 0 0

docker_exists() { command -v docker >/dev/null 2>&1; }

# 只清悬空镜像与构建缓存，不加 -a，不动正在使用的镜像。
clean_docker() {
  run_root_cmd docker image prune -f || return 1
  run_root_cmd docker builder prune -f
}

register_item dev.docker dev 'Docker 悬空镜像与构建缓存' \
  'docker image prune 与 builder prune；需要 docker 与 sudo 权限' \
  func clean_docker '' 1 1 docker_exists
