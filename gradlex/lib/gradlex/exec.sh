# 执行侧：选 Gradle 入口、拼任务路径、起进程；单条记录 exec 顶替进程，多条记录后台共用终端。

# --rebuild 只在显式要求时执行 clean；--refresh 追加依赖刷新，两者可同时用。
REBUILD=0
REFRESH_DEPS=0

# 从构建根向上找 gradlew。找到输出绝对路径，找不到返回 1。
find_wrapper() {
  local dir=$1
  while [[ -n "$dir" && "$dir" != '/' ]]; do
    if [[ -f "$dir/gradlew" ]]; then
      printf '%s\n' "$dir/gradlew"
      return 0
    fi
    dir=$(parent_dir "$dir")
  done
  return 1
}

# CRLF 的 gradlew 在 Linux 上不可用：shebang 会带上 \r，sh 又会把行尾 \r 当命令。
wrapper_has_crlf() {
  grep -q $'\r' "$1" 2>/dev/null
}

# Gradle 入口优先级：GRADLEX_GRADLE > 最近的 gradlew > PATH 里的 gradle。
# 结果写进数组 GRADLE_CMD；wrapper 不可执行时用 sh 调。
# wrapper 是 CRLF 时 Sh 也跑不起来，改为警告后使用系统 gradle，不静默替换。
GRADLE_CMD=()
build_gradle_argv() {
  local dir=$1 wrapper
  GRADLE_CMD=()

  if [[ -n "${GRADLEX_GRADLE:-}" ]]; then
    read -r -a GRADLE_CMD <<< "$GRADLEX_GRADLE"
    return 0
  fi

  if wrapper=$(find_wrapper "$dir"); then
    if wrapper_has_crlf "$wrapper"; then
      printf 'gradlex: %s 含 CRLF 换行，无法直接执行；改用系统 gradle\n' "$wrapper" >&2
    elif [[ -x "$wrapper" ]]; then
      GRADLE_CMD=("$wrapper")
      return 0
    else
      GRADLE_CMD=(sh "$wrapper")
      return 0
    fi
  fi

  command -v gradle >/dev/null 2>&1 ||
    die '找不到 gradle，确认 Gradle 在 PATH 中，或让项目带上可用的 gradlew'
  GRADLE_CMD=(gradle)
}

# 按 --rebuild / --refresh 重写展示命令，让提示行印出的就是真正要执行的。
apply_start_mode() {
  local rec tag workdir projectpath taskargs display cmdtext cmd
  while IFS= read -r rec; do
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"

    cmd='gradle'
    if ((REBUILD)); then
      if [[ -n "$projectpath" ]]; then
        cmd+=" $projectpath:clean $projectpath:$taskargs"
      else
        cmd+=" clean $taskargs"
      fi
    elif [[ -n "$projectpath" ]]; then
      cmd+=" $projectpath:$taskargs"
    else
      cmd+=" $taskargs"
    fi
    ((REFRESH_DEPS)) && cmd+=' --refresh-dependencies'

    emit_record "$tag" "$workdir" "$projectpath" "$taskargs" "$display" "$cmd"
  done
  return 0
}

# 进构建根后 exec 成 Gradle；在子 shell 里调用即后台执行，因为 exec 只替换那个子 shell。
launch_one() {
  local workdir=$1 projectpath=$2 taskargs=$3
  cd "$workdir" || return 1

  build_gradle_argv "$workdir"
  local -a argv=("${GRADLE_CMD[@]}")

  if ((REBUILD)); then
    if [[ -n "$projectpath" ]]; then
      argv+=("$projectpath:clean" "$projectpath:$taskargs")
    else
      argv+=(clean "$taskargs")
    fi
  elif [[ -n "$projectpath" ]]; then
    argv+=("$projectpath:$taskargs")
  else
    argv+=("$taskargs")
  fi
  ((REFRESH_DEPS)) && argv+=(--refresh-dependencies)

  exec "${argv[@]}"
}

launch_records() {
  local -a recs=("$@")
  local rec tag workdir projectpath taskargs display cmdtext

  if [[ ${#recs[@]} -eq 1 ]]; then
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "${recs[0]}"
    printf '在 %s 执行 %s\n' "$workdir" "$cmdtext" >&2
    launch_one "$workdir" "$projectpath" "$taskargs"
    return 1
  fi

  local -a pids=()
  # 中断只收掉等待，子进程照常收到内核发出的 SIGINT 并优雅退出。
  trap ':' INT TERM
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir projectpath taskargs display cmdtext <<< "$rec"
    printf '后台执行 %s\n' "$cmdtext" >&2
    ( launch_one "$workdir" "$projectpath" "$taskargs" ) &
    pids+=($!)
  done
  printf '%d 个已在后台执行，Ctrl+C 停止全部\n' "${#pids[@]}" >&2

  local p
  for p in "${pids[@]}"; do wait "$p" 2>/dev/null; done
  printf '全部已退出\n' >&2
  return 0
}
