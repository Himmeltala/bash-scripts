# 执行侧：启动方式与跳过编译的判定，以及把 mvn 跑起来。
# 单条记录 exec 顶替当前进程，多条记录各自后台但共用这个终端。
# 跳过编译直接跑已有的 class。maven.main.skip 是 maven-compiler-plugin 的参数，
# 3.8.1 上实测有效：compile 阶段照跑，但不产出 class，模块没编过时不要用。
readonly SKIP_ARGS='-Dmaven.main.skip=true -Dmaven.test.skip=true'
# 启动方式。auto 由脚本判定，其余三个由命令行指定，见 usage。
readonly MODE_AUTO='auto' MODE_COMPILE='compile' MODE_NO_COMPILE='no-compile' MODE_REBUILD='rebuild'
# 模块目录下最新的 class 文件路径，给 find -newer 当参照。
# 一次 find 加一次排序取头部，不给每个 class 派生 stat。
newest_class_file() {
  local classes=$1/target/classes
  [[ -d "$classes" ]] || return 1
  local newest
  newest=$(find "$classes" -name '*.class' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1)
  [[ -n "$newest" ]] || return 1
  printf '%s\n' "${newest#* }"
}

# 模块要不要重新编译：0 需要，1 可以跳过。
# 判据只有一条：源码、各级 pom、生成的源里，有文件比 target/classes 下最新的 class 新。
# 源文件比最新 class 旧却没有同名 class，说明它本来就不产出 class（整份被注释掉、只有包
# 声明之类），Maven 会因此每次都判「有改动」并把整个模块重编一遍，判定不跟着它走。
# 资源不在比较范围：拷贝归 resources 插件管，跳过编译不影响它，改了 application.yml
# 这类配置照样进 target/classes。
# 拿不准一律返回「需要」，多编一次只是慢，漏编一次就是跑到旧代码。
needs_compile() {
  local dir=$1 newest d depth=0
  newest=$(newest_class_file "$dir") || return 0

  local -a roots=()
  local r
  for r in "$dir/src/main/java" "$dir/target/generated-sources"; do
    [[ -e "$r" ]] && roots+=("$r")
  done

  # 模块自身与各级父 pom 都算：父 pom 改了依赖或插件版本，等于源码得重编。
  d=$dir
  while [[ -f "$d/pom.xml" && $depth -lt 8 ]]; do
    roots+=("$d/pom.xml")
    d=$(parent_dir "$d")
    [[ "$d" == '/' ]] && break
    depth=$((depth + 1))
  done

  ((${#roots[@]})) || return 0
  # -type f 不能省：目录的 mtime 在建目录、增删文件时都会变，拿它当判据会次次判成
  # 「有改动」。文件的 mtime 才是编辑动作留下的痕迹。
  # -print -quit：找到第一个就收工，目录大时不用扫完。
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

# 按启动方式把记录里传给 mvn 的参数换掉，其余各列原样带回。
# 参数变了就把展示用的命令一起改掉，让提示行印出来的就是真正要跑的东西。
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
          printf '跳过编译「%s」：源码与各级 pom 都没比 target/classes 新（-c 可强制编译）\n' "$tag" >&2
          if ((n > 0)); then
            printf '  另有 %d 个源文件不产出 class，Maven 会因此每次全量重编，把它们移出源码根即可根治\n' "$n" >&2
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

# 进工作目录后把当前进程换成 mvn。放在子 shell 里调用即可得到后台执行，
# 因为 exec 只替换那个子 shell。
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
    printf '正在 %s 执行 %s\n' "$workdir" "$cmdtext" >&2
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
  printf '共 %d 个已在后台执行，输出直接打在本终端，按一次 Ctrl+C 全部停止。\n' "${#pids[@]}" >&2

  local p
  for p in "${pids[@]}"; do wait "$p" 2>/dev/null; done
  printf '全部已退出。\n' >&2
  return 0
}
START_MODE="$MODE_AUTO"
MODE_FLAG=''
