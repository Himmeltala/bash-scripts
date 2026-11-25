# 执行侧：启动方式与跳过编译的判定，以及启动 mvn；单条记录 exec 顶替进程，多条记录后台共用终端。
# maven.main.skip 是 maven-compiler-plugin 的参数，3.8.1 实测有效：compile 阶段照常执行，但不产出 class。
readonly SKIP_ARGS='-Dmaven.main.skip=true -Dmaven.test.skip=true'
# 启动方式。auto 由脚本判定，其余三个由命令行指定，见 usage。
readonly MODE_AUTO='auto' MODE_COMPILE='compile' MODE_NO_COMPILE='no-compile' MODE_REBUILD='rebuild'
# 启动前装依赖：-pl 只编当前模块，兄弟模块从本地仓库取 jar，源码改了没装就会「找不到符号」。
PREP_DEPS=0
# 模块目录下最新的 class 文件路径，供 find -newer 参照；一次 find 加排序取头部，不为每个 class 派生 stat。
newest_class_file() {
  local classes=$1/target/classes
  [[ -d "$classes" ]] || return 1
  local newest
  newest=$(find "$classes" -name '*.class' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1)
  [[ -n "$newest" ]] || return 1
  printf '%s\n' "${newest#* }"
}

# 模块要不要重新编译：源码、生成源、构建入口或各级 pom 里有文件比最新 class 新，就重新编译。
# 源文件比最新 class 旧却没有同名 class，说明它本不产出 class，Maven 会因此每次全量重编，这里不处理；资源不参与比较。
needs_compile() {
  local dir=$1 newest d depth=0
  newest=$(newest_class_file "$dir") || return 0

  local -a roots=()
  local r
  # Java 之外常见的 JVM 语言目录也扫：Java 类引用 Kotlin/Groovy/Scala 的类型时，只看 java 会漏掉这些文件的改动。
  for r in "$dir/src/main/java" "$dir/src/main/kotlin" "$dir/src/main/groovy" "$dir/src/main/scala" \
    "$dir/target/generated-sources" "$dir/mvnw" "$dir/.mvn"; do
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

# 装依赖的标记目录：按工作区分开，文件 mtime 就是上次装成功的时刻。
install_stamp_dir() {
  printf '%s/install-stamps/%s\n' "$CACHE_DIR" "$(printf '%s' "$1" | md5sum | cut -c1-16)"
}

# 启动模块在本工程里直接与间接依赖的模块目录，不含启动模块自身。走 pom 里的依赖图，
# 本工程没有的依赖（第三方 jar）跳过。
dep_module_dirs() {
  local app=$1 pom id dep
  local -a queue=() seen=()
  id=$(project_artifact_id "$app/pom.xml")
  [[ -n "$id" ]] || return 0
  seen=("$id")
  queue=("$id")
  while ((${#queue[@]})); do
    id=${queue[0]}
    queue=("${queue[@]:1}")
    pom=${ARTIFACT_POM_VAL[$id]:-}
    [[ -n "$pom" ]] || continue
    while IFS= read -r dep; do
      [[ -n "$dep" ]] || continue
      [[ " ${seen[*]} " == *" $dep "* ]] && continue
      seen+=("$dep")
      queue+=("$dep")
    done <<< "${POM_DEPS_VAL[$pom]:-}"
  done
  for id in "${seen[@]:1}"; do
    pom=${ARTIFACT_POM_VAL[$id]:-}
    [[ -n "$pom" ]] && parent_dir "$pom"
  done
}

# 依赖模块要不要重新装：没装过、源码比 class 新、class 或 pom 比上次装新，任一条成立就装。
# 源码比 class 新是改了还没编；class 比标记新是别处编过但未必装过；pom 比标记新说明依赖变了。
module_needs_install() {
  local dir=$1 stamp=$2 newest r d depth=0
  local -a roots=()
  for r in "$dir/src/main/java" "$dir/src/main/kotlin" "$dir/src/main/groovy" "$dir/src/main/scala"; do
    [[ -d "$r" ]] && roots+=("$r")
  done
  ((${#roots[@]})) || return 1
  [[ -f "$stamp" ]] || return 0
  newest=$(newest_class_file "$dir") || return 0
  [[ -n $(find "${roots[@]}" -type f -newer "$newest" -print -quit 2>/dev/null) ]] && return 0
  [[ "$newest" -nt "$stamp" ]] && return 0
  d=$dir
  while [[ -f "$d/pom.xml" && $depth -lt 8 ]]; do
    [[ "$d/pom.xml" -nt "$stamp" ]] && return 0
    d=$(parent_dir "$d")
    [[ -z "$d" || "$d" == '/' ]] && break
    depth=$((depth + 1))
  done
  return 1
}

# 本次启动要补装的依赖模块，一行一个目录；没有要装的返回 1。
stale_dep_modules() {
  local workdir=$1 plpath=$2 base dir
  base=$(install_stamp_dir "$workdir")
  local -a dirs=()
  while IFS= read -r dir; do
    [[ -n "$dir" ]] || continue
    module_needs_install "$dir" "$base/${dir#"$workdir"/}" && dirs+=("$dir")
  done < <(dep_module_dirs "$workdir/$plpath")
  ((${#dirs[@]})) || return 1
  printf '%s\n' "${dirs[@]}"
}

# 启动前只装真正过期的依赖模块，不碰没改的模块与无关模块；装失败就退出，不带着旧 jar 硬起。
prep_dependencies() {
  local workdir=$1 plpath=$2 base dir rel list
  base=$(install_stamp_dir "$workdir")
  local -a dirs=() rels=()
  if [[ -n "$plpath" ]]; then
    mapfile -t dirs < <(stale_dep_modules "$workdir" "$plpath")
  fi
  ((${#dirs[@]})) || return 0
  for dir in "${dirs[@]}"; do
    rel="${dir#"$workdir"/}"
    rels+=("$rel")
  done
  list=$(IFS=,; printf '%s' "${rels[*]}")
  printf '启动前安装改动的依赖模块：%s\n' "$list"
  # 先 clean：target 里可能留着没跑注解处理器编出的 class（例如 Lombok 的 getter 缺失），
  # 只 install 会被「Nothing to compile」原样打进本地仓库，消费方就报找不到符号。
  mvn -pl "$list" clean install -Dmaven.test.skip=true -Dspring-boot.repackage.skip=true || return 1
  for rel in "${rels[@]}"; do
    mkdir -p "$(dirname "$base/$rel")"
    touch "$base/$rel"
  done
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
        if [[ $allow_skip -eq 1 ]]; then
          if needs_compile "$dir"; then
            if [[ -z $(newest_class_file "$dir") ]]; then
              printf '编译「%s」：还没有已编译的 class\n' "$tag" >&2
            else
              printf '编译「%s」：源码、生成源、构建入口或 pom 有更新\n' "$tag" >&2
            fi
          elif ((PREP_DEPS)) && [[ -n "$plpath" ]] && stale_dep_modules "$workdir" "$plpath" >/dev/null; then
            # 依赖模块换了 jar，当前模块的 class 是按旧依赖编的，一起重编。
            printf '编译「%s」：依赖模块有更新\n' "$tag" >&2
          else
            mvnargs+=" $SKIP_ARGS"
            n=$(count_classless_sources "$dir")
            printf '跳过编译「%s」：源码未更新（-c 正常编译，--rebuild 先 clean）\n' "$tag" >&2
            if ((n > 0)); then
              printf '  另有 %d 个源文件不产出 class，会触发全量重编\n' "$n" >&2
            fi
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

  if ((PREP_DEPS)) && [[ -n "$plpath" ]]; then
    prep_dependencies "$workdir" "$plpath" || return 1
  fi

  local -a argv=()
  [[ -n "$plpath" ]] && argv+=(-pl "$plpath")
  if [[ -n "$mvnargs" ]]; then
    local -a extra=()
    read -r -a extra <<< "$mvnargs"
    argv+=("${extra[@]}")
  fi

  exec mvn "${argv[@]}"
}
START_MODE="$MODE_AUTO"
MODE_FLAG=''
