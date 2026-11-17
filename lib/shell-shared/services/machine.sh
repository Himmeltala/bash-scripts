# @Author: Himmeltala
# @Date: 2026-11-17 23:46:49
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-17 23:46:49
# @FilePath: \lib\shell-shared\services\machine.sh
# @Description: 机器接口：网页壳读的 --list --json 目标清单，以及整批启动六列记录。
# 记录固定六列：标签、工作目录、工具自己的两列、展示路径、展示命令；启动函数由调用方传入。
# shellcheck shell=bash
# shellcheck disable=SC2154

shell_json_escape() {
  local text=$1
  text=${text//\\/\\\\}
  text=${text//\"/\\\"}
  text=${text//$'\n'/\\n}
  text=${text//$'\r'/\\r}
  text=${text//$'\t'/\\t}
  printf '%s' "$text"
}

# 一条命令的目标清单：collector 输出六列记录，这里拼成 jvmx 网页壳读的那份 JSON。
shell_machine_json() {
  local cmd=$1 collector=$2 first=1 rec tag workdir f3 f4 display cmdtext
  printf '{"command":"%s","root":"%s","targets":[' \
    "$(shell_json_escape "$cmd")" "$(shell_json_escape "$PWD")"
  while IFS= read -r rec; do
    [[ -n "$rec" ]] || continue
    IFS=$FS read -r tag workdir f3 f4 display cmdtext <<< "$rec"
    ((first)) || printf ','
    first=0
    printf '{"id":"%s","command":"%s","tag":"%s","path":"%s","cwd":"%s","display":"%s"}' \
      "$(shell_json_escape "$cmd:$tag")" "$(shell_json_escape "$cmd")" "$(shell_json_escape "$tag")" \
      "$(shell_json_escape "$f3")" "$(shell_json_escape "$workdir")" "$(shell_json_escape "$cmdtext")"
  done < <("$collector" "$cmd")
  printf ']}\n'
}

# 启动整批记录：launcher 收「工作目录、第三列、第四列」三个参数。单条记录 exec 顶替进程，
# 多条记录后台共用终端，等全部退出才回来。
shell_launch_records() {
  local launcher=$1
  shift
  local -a recs=("$@")
  local rec tag workdir f3 f4 display cmdtext

  if [[ ${#recs[@]} -eq 1 ]]; then
    IFS=$FS read -r tag workdir f3 f4 display cmdtext <<< "${recs[0]}"
    printf '在 %s 执行 %s\n' "$workdir" "$cmdtext" >&2
    "$launcher" "$workdir" "$f3" "$f4"
    return 1
  fi

  local -a pids=()
  # 中断只收掉等待，子进程照常收到内核发出的 SIGINT 并优雅退出。
  trap ':' INT TERM
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir f3 f4 display cmdtext <<< "$rec"
    printf '后台执行 %s\n' "$cmdtext" >&2
    ( "$launcher" "$workdir" "$f3" "$f4" ) &
    pids+=($!)
  done
  printf '%d 个已在后台执行，Ctrl+C 停止全部\n' "${#pids[@]}" >&2

  local p
  for p in "${pids[@]}"; do wait "$p" 2>/dev/null; done
  printf '全部已退出\n' >&2
  return 0
}
