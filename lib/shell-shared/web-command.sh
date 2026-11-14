# 网页模式的公共启动流程：选 python、校验端口与页面、起转发进程、等 READY、打印地址或 JSON。
# 调用方设好 WEB_TOOL、WEB_ROOT、WEB_SERVER_PY、WEB_STATIC_DIR、WEB_READY_MARKER、
# WEB_PYTHON_ENV、WEB_JSON_FLAG、WEB_JSON_WAIT、WEB_SERVER_ARGS、WEB_WARN_TEXT、
# WEB_EXIT_TEXT，并在项目模块里定义 web_fail 与 web_python。
# 可选钩子：web_command_precheck（校验环境，失败返回非 0）与 web_command_extra_warn（追加提示）。
# shellcheck shell=bash
# shellcheck source=./web-state.sh
# shellcheck disable=SC2154

# 起 python，等它就绪，然后就守着它；Ctrl+C 连 python 一起带走。
web_command() {
  local runner child log line='' waited=0 ans url local_url page_rel
  local -a open_arg=()
  runner=$(web_python "$WEB_PYTHON_ENV") || return
  RV_PORT=${RV_PORT:-0}
  RV_HOST=${RV_HOST:-0.0.0.0}
  [[ "$RV_PORT" =~ ^[0-9]+$ ]] && ((RV_PORT >= 0 && RV_PORT <= 65535)) ||
    { web_fail "端口不对：$RV_PORT" "$EXIT_USAGE"; return; }
  # 报错里用 <工具>/web/... 的短路径：WEB_STATIC_DIR 往上三级是 <工具> 目录。
  page_rel=${WEB_PAGE#"${WEB_STATIC_DIR%/*/*/*}/"}
  [[ -f "$WEB_PAGE" ]] ||
    { web_fail "缺 $page_rel，前端还没打包（见 $WEB_TOOL/web/README.md）" "$EXIT_USAGE"; return; }
  if declare -F web_command_precheck >/dev/null; then
    web_command_precheck || return
  fi

  mkdir -p "$WEB_HOME"
  [[ -n "${WEB_LOG_DIR:-}" ]] && mkdir -p "$WEB_LOG_DIR"
  log="$WEB_HOME/runner.log"
  : >"$log"
  ((RV_OPEN)) && open_arg+=(--open)

  "$runner" "$WEB_SERVER_PY" --static "$WEB_STATIC_DIR" \
    ${WEB_SERVER_ARGS[@]+"${WEB_SERVER_ARGS[@]}"} \
    --host "$RV_HOST" --port "$RV_PORT" "${open_arg[@]}" >"$log" 2>&1 &
  child=$!
  trap 'kill -TERM "$child" 2>/dev/null' INT TERM HUP

  # 地址由 python 选好再报上来：端口是 0 时它报的是实际用的那个。
  while ((waited < WEB_ATTACH_TIMEOUT * 4)); do
    if ans=$(grep -m 1 "^$WEB_READY_MARKER " "$log" 2>/dev/null); then
      line=${ans#"$WEB_READY_MARKER "}
      break
    fi
    kill -0 "$child" 2>/dev/null || { web_fail "网页服务起不来：$(tail -n 3 "$log" 2>/dev/null)"; return; }
    sleep 0.25
    waited=$((waited + 1))
  done
  [[ -n "$line" ]] || { web_fail '等网页服务就绪超时'; return; }

  # python 报上来的是「主机:端口」：端口填 0 时它是实际用上的那个，绑所有网卡时主机是猜出来的局域网地址。
  url="http://$line/"
  local_url="http://127.0.0.1:${line##*:}/"
  if ((WEB_JSON_FLAG)); then
    printf '{"url":"%s","local":"%s","host":"%s","port":"%s"}\n' \
      "$url" "$local_url" "$RV_HOST" "${line##*:}"
    ((WEB_JSON_WAIT)) && wait "$child"
    return 0
  fi
  printf '%s 网页界面：%s\n' "$WEB_TOOL" "$url"
  [[ "$url" == "$local_url" ]] || printf '本机 %s\n' "$local_url"
  # 页面没有登录：能连上的人都能操作，这一点得说在前面。
  [[ "$RV_HOST" == '127.0.0.1' || "$RV_HOST" == 'localhost' ]] ||
    printf '%s\n' "$WEB_WARN_TEXT" >&2
  if declare -F web_command_extra_warn >/dev/null; then
    web_command_extra_warn
  fi
  printf '%s\n' "$WEB_EXIT_TEXT" >&2
  wait "$child"
}
