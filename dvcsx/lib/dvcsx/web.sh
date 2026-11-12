# 网页模式：起 python3 转发进程，静态页面与 SVN / Git 查询接口都由它出。

# 缺省值在这里定，parse_args 里覆盖，dvcsx -p 9999 web 与 dvcsx web -p 9999 等价。
RV_PORT=0
RV_HOST='0.0.0.0'
RV_OPEN=0
RV_JSON=0
readonly WEB_ATTACH_TIMEOUT=20

readonly WEB_HOME="$CACHE_DIR/web"
readonly WEB_STATE_FILE="$WEB_HOME/state.json"
readonly WEB_API_PREFIX='/__dvcsx/api'
readonly WEB_PAGE="$dvcsx_dir/dvcsx/web/static/index.html"

web_fail() {
  printf 'dvcsx: %s\n' "$1" >&2
  return "${2:-$EXIT_FAIL}"
}

# 打印可用的 python3 解释器；没有或太旧就报错。只支持标准库，3.7 起够用。
web_python() {
  local runner=${DVCSX_PYTHON:-python3} ver
  command -v "$runner" >/dev/null 2>&1 ||
    { web_fail "找不到 $runner，网页模式的转发进程靠它，先装上 python3" "$EXIT_USAGE"; return; }
  ver=$("$runner" -c 'import sys; print(sys.version_info[0] * 10 + sys.version_info[1])' 2>/dev/null) ||
    { web_fail "跑不起 $runner" "$EXIT_USAGE"; return; }
  ((ver >= 37)) || { web_fail '网页模式需要 python 3.7 或更新版本' "$EXIT_USAGE"; return; }
  printf '%s\n' "$runner"
}

web_command() {
  local runner child log line='' waited=0 url local_url
  local -a open_arg=()
  runner=$(web_python) || return
  RV_PORT=${RV_PORT:-0}
  RV_HOST=${RV_HOST:-0.0.0.0}
  [[ "$RV_PORT" =~ ^[0-9]+$ ]] && ((RV_PORT >= 0 && RV_PORT <= 65535)) ||
    { web_fail "端口不对：$RV_PORT" "$EXIT_USAGE"; return; }
  [[ -f "$WEB_PAGE" ]] ||
    { web_fail "缺 ${WEB_PAGE#"$dvcsx_dir"/}，前端还没打包（见 dvcsx/web/README.md）" "$EXIT_USAGE"; return; }
  command -v svn >/dev/null 2>&1 || command -v git >/dev/null 2>&1 ||
    { web_fail '找不到 svn 与 git 命令，装上其中一个再试' "$EXIT_USAGE"; return; }

  mkdir -p "$WEB_HOME"
  log="$WEB_HOME/runner.log"
  : >"$log"
  ((RV_OPEN)) && open_arg+=(--open)

  "$runner" "$dvcsx_dir/dvcsx/web/server.py" \
    --static "$dvcsx_dir/dvcsx/web/static" \
    --state "$WEB_STATE_FILE" --api "$WEB_API_PREFIX" \
    --host "$RV_HOST" --port "$RV_PORT" "${open_arg[@]}" >"$log" 2>&1 &
  child=$!
  trap 'kill -TERM "$child" 2>/dev/null' INT TERM HUP

  while ((waited < WEB_ATTACH_TIMEOUT * 4)); do
    if line=$(grep -m 1 '^DVCSX_WEB_READY ' "$log" 2>/dev/null); then
      line=${line#DVCSX_WEB_READY }
      break
    fi
    kill -0 "$child" 2>/dev/null || { web_fail "网页服务起不来：$(tail -n 3 "$log" 2>/dev/null)"; return; }
    sleep 0.25
    waited=$((waited + 1))
  done
  [[ -n "$line" ]] || { web_fail '等网页服务就绪超时'; return; }

  url="http://$line/"
  local_url="http://127.0.0.1:${line##*:}/"
  if ((RV_JSON)); then
    printf '{"url":"%s","local":"%s","host":"%s","port":"%s"}\n' \
      "$url" "$local_url" "$RV_HOST" "${line##*:}"
    wait "$child"
    return 0
  fi
  printf 'dvcsx 网页界面：%s\n' "$url"
  [[ "$url" == "$local_url" ]] || printf '本机 %s\n' "$local_url"
  [[ "$RV_HOST" == '127.0.0.1' || "$RV_HOST" == 'localhost' ]] ||
    printf '页面没有登录，同一网络里能连上的人都能查看工作副本的变更与日志；只想本机用就加 --host 127.0.0.1\n' >&2
  printf '按 Ctrl+C 退出网页服务。\n' >&2
  wait "$child"
}
