# 执行侧：记录里的参数就是完整命令，进包目录直接执行；单条记录 exec 顶替进程，多条记录后台共用终端。

# 进目录后 exec 成记录里的那条命令；在子 shell 里调用即后台执行，因为 exec 只替换那个子 shell。
launch_one() {
  local workdir=$1 args=$2
  cd "$workdir" || return 1

  local -a argv=()
  if [[ -n "$args" ]]; then
    read -r -a argv <<< "$args"
  fi
  exec "${argv[@]}"
}

# 不 exec，跑完回到调用方。装依赖要串行：同一个工作区里两条 install 同时跑会抢锁。
run_one() {
  local workdir=$1 args=$2
  local -a argv=()
  [[ -n "$args" ]] && read -r -a argv <<< "$args"
  ( cd "$workdir" && exec "${argv[@]}" )
}

# 串行执行多条记录，前一条失败就停。
run_serial() {
  local rec tag workdir pkgrel args display cmdtext
  for rec in "$@"; do
    IFS=$FS read -r tag workdir pkgrel args display cmdtext <<< "$rec"
    printf '执行 %s\n' "$cmdtext" >&2
    run_one "$workdir" "$args" || return 1
  done
  return 0
}

launch_records() {
  local -a recs=("$@")
  local rec tag workdir pkgrel args display cmdtext

  if [[ ${#recs[@]} -eq 1 ]]; then
    IFS=$FS read -r tag workdir pkgrel args display cmdtext <<< "${recs[0]}"
    printf '在 %s 执行 %s\n' "$workdir" "$cmdtext" >&2
    launch_one "$workdir" "$args"
    return 1
  fi

  local -a pids=()
  # 中断只收掉等待，子进程照常收到内核发出的 SIGINT 并优雅退出。
  trap ':' INT TERM
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir pkgrel args display cmdtext <<< "$rec"
    printf '后台执行 %s\n' "$cmdtext" >&2
    ( launch_one "$workdir" "$args" ) &
    pids+=($!)
  done
  printf '%d 个已在后台执行，Ctrl+C 停止全部\n' "${#pids[@]}" >&2

  local p
  for p in "${pids[@]}"; do wait "$p" 2>/dev/null; done
  printf '全部已退出\n' >&2
  return 0
}
