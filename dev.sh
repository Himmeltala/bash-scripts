#!/usr/bin/env bash
# 开发者模式：后端直接跑仓库里的源码，前端交给 Vite 热更新；改 Python 自动重启后端。
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tool=${1:-idex}
vite_port=${DEV_VITE_PORT:-}
dev_host=${DEV_HOST:-127.0.0.1}

case "$tool" in
  idex)
    vite_port=${vite_port:-5173}
    web_dir="$repo/idex/web"
    static="$repo/idex/web/dist"
    origin_var=IDEX_WEB_ORIGIN
    backend_port=${DEV_BACKEND_PORT:-8771}
    watch_dirs=("$repo/idex/src" "$repo/lib/py-shared")
    start_backend() {
      "$repo/idex/bin/idex" web --host "$dev_host" -p "$backend_port" --allow-write
    }
    ;;
  llmx)
    vite_port=${vite_port:-5174}
    web_dir="$repo/llmx/web"
    static="$repo/llmx/web/dist"
    origin_var=LLMX_WEB_ORIGIN
    backend_port=${DEV_BACKEND_PORT:-8770}
    watch_dirs=("$repo/llmx/src" "$repo/lib/py-shared")
    start_backend() {
      PYTHONPATH="$repo/llmx/src${PYTHONPATH:+:$PYTHONPATH}" \
        python3 -m llmx web --host "$dev_host" --port "$backend_port" --allow-write
    }
    ;;
  netx)
    vite_port=${vite_port:-5175}
    web_dir="$repo/netx/web"
    static="$repo/netx/lib/netx/static"
    origin_var=NETX_WEB_ORIGIN
    backend_port=${DEV_BACKEND_PORT:-8400}
    watch_dirs=("$repo/netx/lib" "$repo/lib/py-shared")
    start_backend() {
      PYTHONPATH="$repo/netx/lib${PYTHONPATH:+:$PYTHONPATH}" \
        python3 -m netx web --host "$dev_host" --port "$backend_port" --allow-write
    }
    ;;
  *)
    printf '用法: %s [idex|llmx|netx]\n' "$(basename "$0")" >&2
    exit 2
    ;;
esac

need_npm() {
  command -v npm >/dev/null 2>&1 || {
    printf '找不到 npm，前端开发模式需要 Node 与 npm\n' >&2
    exit 3
  }
}

install_deps() {
  local dir=$1
  [[ -d "$dir/node_modules" ]] && return 0
  printf '安装 %s 的依赖\n' "${dir#"$repo"/}"
  ( cd "$dir" && npm ci --no-audit --no-fund )
}

# 共用包走 dist 导出，先把这一段编出来；比每次都跑完整安装省事。
prepare_web() {
  need_npm
  install_deps "$repo/lib/web-shared"
  ( cd "$repo/lib/web-shared" && npm run build >/dev/null )
  install_deps "$web_dir"
  # 后端启动时要看静态目录里有没有 index.html；只在缺的时候补一次，之后页面走 Vite。
  if [[ ! -f "$static/index.html" ]]; then
    printf '前端静态产物缺失，先构建一次\n'
    ( cd "$web_dir" && npm run build )
  fi
}

# 命令行工具会再拉 python 或 node，收的时候要连子进程一起收。
kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

# 后端由主进程和监听线程轮流起停，PID 放在临时文件里，两边都按同一份收。
backend_pid_file=$(mktemp)
watch_pid=''
vite_pid=''

stop_backend() {
  local pid i
  pid=$(cat "$backend_pid_file" 2>/dev/null || true)
  [[ -n "$pid" ]] || return 0
  kill_tree "$pid"
  for ((i = 0; i < 50; i++)); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  kill -9 "$pid" 2>/dev/null || true
  : > "$backend_pid_file"
}

probe_host() {
  if [[ "$dev_host" == '0.0.0.0' ]]; then
    printf '127.0.0.1'
  else
    printf '%s' "$dev_host"
  fi
}

wait_port() {
  local i target
  target=$(probe_host)
  for ((i = 0; i < 100; i++)); do
    ( exec 3<>"/dev/tcp/$target/$backend_port" ) 2>/dev/null && return 0
    sleep 0.1
  done
  return 1
}

start_backend_bg() {
  start_backend &
  echo $! > "$backend_pid_file"
  wait_port || {
    printf '后端没在 %s:%s 起来，看上面的报错\n' "$(probe_host)" "$backend_port" >&2
    stop_backend
    exit 1
  }
}

reload_loop() {
  local stamp newer
  stamp=$(mktemp)
  trap 'rm -f "$stamp"' EXIT
  touch "$stamp"
  while sleep 1; do
    newer=$(find "${watch_dirs[@]}" -name '*.py' -newer "$stamp" -print -quit 2>/dev/null || true)
    [[ -n "$newer" ]] || continue
    touch "$stamp"
    printf '\n检测到 Python 改动，重启后端\n'
    stop_backend
    start_backend_bg
  done
}

cleanup() {
  stop_backend
  [[ -n "$watch_pid" ]] && kill_tree "$watch_pid"
  [[ -n "$vite_pid" ]] && kill_tree "$vite_pid"
  rm -f "$backend_pid_file"
}
trap cleanup EXIT INT TERM

prepare_web
start_backend_bg
reload_loop &
watch_pid=$!

show_host=$(probe_host)
printf '\n后端 http://%s:%s/\n前端 http://%s:%s/  改前端即时热更新，Ctrl+C 退出\n\n' \
  "$show_host" "$backend_port" "$show_host" "$vite_port"

# Vite 的输出直接可见；放进后台再等它，Ctrl+C 时 trap 才能把后端与它一起收掉。
env "$origin_var=http://$(probe_host):$backend_port" \
  npm --prefix "$web_dir" run dev -- --host "$dev_host" --port "$vite_port" --strictPort &
vite_pid=$!
wait "$vite_pid"
