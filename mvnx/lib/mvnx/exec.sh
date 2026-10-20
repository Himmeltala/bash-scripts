# 执行侧：启动方式与跳过编译的判定，以及启动 mvn；单条记录 exec 顶替进程，多条记录后台共用终端。
# maven.main.skip 是 maven-compiler-plugin 的参数，3.8.1 实测有效：compile 阶段照常执行，但不产出 class。
readonly SKIP_ARGS='-Dmaven.main.skip=true -Dmaven.test.skip=true'
# 启动方式。auto 由脚本判定，其余三个由命令行指定，见 usage。
readonly MODE_AUTO='auto' MODE_COMPILE='compile' MODE_NO_COMPILE='no-compile' MODE_REBUILD='rebuild'
# 模块目录下最新的 class 文件路径，供 find -newer 参照；一次 find 加排序取头部，不为每个 class 派生 stat。
newest_class_file() {
  local classes=$1/target/classes
  [[ -d "$classes" ]] || return 1
  local newest
  newest=$(find "$classes" -name '*.class' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1)
  [[ -n "$newest" ]] || return 1
  printf '%s\n' "${newest#* }"
}

# 模块要不要重新编译：源码、各级 pom 或生成源里有文件比最新 class 新，就重新编译。
# 源文件比最新 class 旧却没有同名 class，说明它本不产出 class，Maven 会因此每次全量重编，这里不处理；资源不参与比较。
needs_compile() {
  local dir=$1 newest d depth=0
  newest=$(newest_class_file "$dir") || return 0

  local -a roots=()
  local r
  for r in "$dir/src/main/java" "$dir/target/generated-sources"; do
    [[ -e "$r" ]] && roots+=("$r")
  done

  # 模块自身与各级父 pom 都算：父 pom 改了依赖或插件版本，说明源码需要重编。
  d=$dir
  while [[ -f "$d/pom.xml" && $depth -lt 8 ]]; do
    roots+=("$d/pom.xml")
    d=$(parent_dir "$d")
    [[ "$d" == '/' ]] && break
    depth=$((depth + 1))
  done

  ((${#roots[@]})) || return 0
  # -type f 不能省：目录 mtime 会随增删文件变化；-print -quit 找到第一个就停止，不必扫完。
  [[ -n $(find "${roots[@]}" -type f -newer "$newest" -print -quit 2>/dev/null) ]]
}

# 数一遍不产出 class 的源文件。只在跳过编译时用来提示，跳过编译多半就是它们引起的。
count_classless_sources() {
  local dir=$1 classes=$1/target/classes n=0 f rel
  [[ -d "$classes" && -d "$dir/src/main/java" ]] || { printf '0\n'; return 0; }
  while IFS= read -r f; do
    rel="${f#"$dir"/src/main/java/}"
    rel="${rel%.java}.class"
    [[ -f "$classes/$rel" ]] || n=$((n + 1))
  done < <(find "$dir/src/main/java" -name '*.java' 2>/dev/null)
  printf '%s\n' "$n"
}

# 按启动方式替换记录里传给 mvn 的参数，其余列原样带回；参数变了同步改展示命令，让提示行印出的就是真正要执行的。
apply_start_mode() {
  local allow_skip=$1 rec tag workdir plpath mvnargs display cmdtext dir n before
  while IFS= read -r rec; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    dir=$workdir
    [[ -n "$plpath" ]] && dir="$workdir/$plpath"
    before=$mvnargs

    case "$START_MODE" in
      "$MODE_NO_COMPILE")
        mvnargs+=" $SKIP_ARGS"
        ;;
      "$MODE_REBUILD")
        mvnargs="clean $mvnargs"
        ;;
      "$MODE_AUTO")
        if [[ $allow_skip -eq 1 ]] && ! needs_compile "$dir"; then
          mvnargs+=" $SKIP_ARGS"
          n=$(count_classless_sources "$dir")
          printf '跳过编译「%s」：源码未更新（-c 强制编译）\n' "$tag" >&2
          if ((n > 0)); then
            printf '  另有 %d 个源文件不产出 class，会触发全量重编\n' "$n" >&2
          fi
        fi
        ;;
    esac

    if [[ "$mvnargs" != "$before" ]]; then
      cmdtext='mvn'
      [[ -n "$plpath" ]] && cmdtext+=" -pl $plpath"
      cmdtext+=" $mvnargs"
    fi
    emit_record "$tag" "$workdir" "$plpath" "$mvnargs" "$display" "$cmdtext"
  done
  return 0
}

# 进工作目录后 exec 成 mvn；在子 shell 里调用即后台执行，因为 exec 只替换那个子 shell。
launch_one() {
  local workdir=$1 plpath=$2 mvnargs=$3
  cd "$workdir" || return 1

  local -a argv=()
  [[ -n "$plpath" ]] && argv+=(-pl "$plpath")
  if [[ -n "$mvnargs" ]]; then
    local -a extra=()
    read -r -a extra <<< "$mvnargs"
    argv+=("${extra[@]}")
  fi

  exec mvn "${argv[@]}"
}

launch_records() {
  local -a recs=("$@")
  local rec tag workdir plpath mvnargs display cmdtext

  if [[ ${#recs[@]} -eq 1 ]]; then
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "${recs[0]}"
    printf '在 %s 执行 %s\n' "$workdir" "$cmdtext" >&2
    launch_one "$workdir" "$plpath" "$mvnargs"
    return 1
  fi

  local -a pids=()
  # 中断只收掉等待，子进程照常收到内核发出的 SIGINT 并优雅退出。
  trap ':' INT TERM
  for rec in "${recs[@]}"; do
    IFS=$FS read -r tag workdir plpath mvnargs display cmdtext <<< "$rec"
    printf '后台执行 %s\n' "$cmdtext" >&2
    ( launch_one "$workdir" "$plpath" "$mvnargs" ) &
    pids+=($!)
  done
  printf '%d 个已在后台执行，Ctrl+C 停止全部\n' "${#pids[@]}" >&2

  local p
  for p in "${pids[@]}"; do wait "$p" 2>/dev/null; done
  printf '全部已退出\n' >&2
  return 0
}
START_MODE="$MODE_AUTO"
MODE_FLAG=''
