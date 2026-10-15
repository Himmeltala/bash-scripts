# pom 扫描与解析：找出工作副本里的全部 pom，一次调用解析出 id、打包方式、
# 引了哪些启动插件、子模块，填进 POM_LIST 与各数组；再据此判定可启动模块、
# 往上找聚合根。数组只在主 shell 里填一次，其余文件只读。
readonly SKIP_DIRS=(target .svn .git node_modules .idea .settings)
# 一次调用把一个 pom 需要的信息全部取出来，输出带前缀的行：
#   ID  <artifactId>  项目自身的 id，<parent> 里的不算
#   PKG pom           打包方式是 pom
#   SB  1             引了 spring-boot-maven-plugin
#   JETTY 1           引了 jetty-maven-plugin
#   TOMCAT 1          引了 tomcat-maven-plugin
#   MOD <entry>       <modules> 里声明的子模块，一行一个
readonly POM_AWK='
BEGIN { open = 0; inparent = 0; inmodules = 0; idval = "" }
{
  line = $0
  while (1) {
    if (open) {
      i = index(line, "-->")
      if (i == 0) { line = ""; break }
      line = substr(line, i + 3)
      open = 0
      continue
    }
    i = index(line, "<!--")
    if (i == 0) break
    rest = substr(line, i + 4)
    j = index(rest, "-->")
    if (j == 0) { line = substr(line, 1, i - 1); open = 1; break }
    line = substr(line, 1, i - 1) substr(rest, j + 3)
  }

  # 只摘掉行内的 parent 片段，不能整行 next：
  # pom 若把 <parent> 与项目自身坐标写在同一行，整行跳掉会把 artifactId 也一起丢掉。
  while (1) {
    if (inparent) {
      q = index(line, "</parent>")
      if (q == 0) { line = ""; break }
      line = substr(line, q + 9)
      inparent = 0
      continue
    }
    p = index(line, "<parent>")
    if (p == 0) break
    head = substr(line, 1, p - 1)
    tail = substr(line, p + 8)
    q = index(tail, "</parent>")
    if (q == 0) { line = head; inparent = 1; break }
    line = head substr(tail, q + 9)
  }

  if (idval == "" && match(line, /<artifactId>[^<]*<\/artifactId>/)) {
    idval = substr(line, RSTART + 12, RLENGTH - 25)
  }
  if (line ~ /<packaging>[ \t]*pom[ \t]*<\/packaging>/) print "PKG pom"
  if (line ~ /spring-boot-maven-plugin/) print "SB 1"
  if (line ~ /jetty-maven-plugin/) print "JETTY 1"
  if (line ~ /tomcat-maven-plugin/) print "TOMCAT 1"

  if (line ~ /<modules>/) inmodules = 1
  if (inmodules) {
    s = line
    while (match(s, /<module>[^<]*<\/module>/)) {
      m = substr(s, RSTART + 8, RLENGTH - 17)
      gsub(/^[ \t\r\n]+/, "", m)
      gsub(/[ \t\r\n]+$/, "", m)
      if (m != "") print "MOD " m
      s = substr(s, RSTART + RLENGTH)
    }
    if (line ~ /<\/modules>/) inmodules = 0
  }
}
END { print "ID " idval }
'
scan_poms() {
  local expr=() d
  for d in "${SKIP_DIRS[@]}"; do expr+=(-name "$d" -o); done
  expr+=(-false)
  find "$1" \( "${expr[@]}" \) -prune -o -type f -name pom.xml -print 2>/dev/null
}

# 每个 pom 在一次扫描里会被反复问「你声明了哪些子模块」「你叫什么」「能不能跑」，
# 所以先统一解析一遍填进数组，之后只读不写。
#
# 这一步必须在主 shell 里做：can_reach 之类是在命令替换与进程替换的子 shell 里跑的，
# 子 shell 里对数组的写入会随子 shell 一起丢掉，缓存在里面等于没建。
declare -a POM_LIST=()

declare -A POM_MODULES_VAL=()
declare -A POM_ARTIFACT_VAL=()
declare -A POM_PKG_VAL=()
declare -A POM_SB_VAL=()
declare -A POM_JETTY_VAL=()
declare -A POM_TOMCAT_VAL=()
declare -A HAS_MAIN_CLASS=()
declare -A HAS_WEBAPP=()
# war 项目实际执行的目标，两个插件都声明时取 jetty，只声明 tomcat 时取 tomcat。
declare -A WEBRUN_GOAL=()

prepare_scan() {
  local root=$1 pom dump line mods
  mapfile -t POM_LIST < <(scan_poms "$root" | sort)

  POM_MODULES_VAL=()
  POM_ARTIFACT_VAL=()
  POM_PKG_VAL=()
  POM_SB_VAL=()
  POM_JETTY_VAL=()
  POM_TOMCAT_VAL=()
  HAS_MAIN_CLASS=()
  HAS_WEBAPP=()
  WEBRUN_GOAL=()

  for pom in "${POM_LIST[@]}"; do
    dump=$(awk "$POM_AWK" "$pom")
    mods=''
    while IFS= read -r line; do
      case "$line" in
        'ID '*) POM_ARTIFACT_VAL[$pom]="${line#ID }" ;;
        'MOD '*) mods+="${line#MOD }"$'\n' ;;
        'PKG '*) POM_PKG_VAL[$pom]=1 ;;
        'SB '*) POM_SB_VAL[$pom]=1 ;;
        'JETTY '*) POM_JETTY_VAL[$pom]=1 ;;
        'TOMCAT '*) POM_TOMCAT_VAL[$pom]=1 ;;
      esac
    done <<< "$dump"
    POM_MODULES_VAL[$pom]="${mods%$'\n'}"
  done

  # 入口类检查按模块各自的源码目录来跑，只对已经通过前两道检查的 pom 跑。
  # 不要图省事改成对整个扫描根跑一次 grep：从家目录或 projs 根扫时，底下压着
  # .vscode-server、node_modules 这类大目录，实测比逐个模块查还慢。
  local dir
  for pom in "${POM_LIST[@]}"; do
    [[ -n "${POM_SB_VAL[$pom]:-}" ]] || continue
    [[ -n "${POM_PKG_VAL[$pom]:-}" ]] && continue
    dir=$(parent_dir "$pom")
    [[ -d "$dir/src/main/java" ]] || continue
    grep -rql --include='*.java' '@SpringBootApplication' "$dir/src/main/java" 2>/dev/null &&
      HAS_MAIN_CLASS[$dir]=1
  done

  for pom in "${POM_LIST[@]}"; do
    [[ -n "${POM_JETTY_VAL[$pom]:-}${POM_TOMCAT_VAL[$pom]:-}" ]] || continue
    [[ -n "${POM_PKG_VAL[$pom]:-}" ]] && continue
    dir=$(parent_dir "$pom")
    [[ -d "$dir/src/main/webapp" ]] || continue
    HAS_WEBAPP[$dir]=1
    if [[ -n "${POM_JETTY_VAL[$pom]:-}" ]]; then
      WEBRUN_GOAL[$dir]='jetty:run'
    else
      WEBRUN_GOAL[$dir]='tomcat:run'
    fi
  done
  return 0
}

pom_modules() {
  [[ -n "${POM_MODULES_VAL[$1]:-}" ]] && printf '%s\n' "${POM_MODULES_VAL[$1]}"
  return 0
}

project_artifact_id() {
  printf '%s\n' "${POM_ARTIFACT_VAL[$1]:-}"
  return 0
}

# 从某个聚合 pom 出发，沿 <modules> 一层层往下走，看能不能走到目标目录。
# -pl 接收的是从当前目录算起的路径，嵌套的模块即便没有直接声明也能寻址，
# 所以要递归往下找，只看一层不够。
can_reach() {
  local agg=$1 target=$2 depth=${3:-0}
  ((depth > 8)) && return 1
  local entry sub
  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    sub=$(normalize_path "$agg/$entry")
    if [[ "$sub" == "$target" ]]; then
      return 0
    elif [[ -f "$sub/pom.xml" && "$target" == "$sub"/* ]]; then
      can_reach "$sub" "$target" $((depth + 1)) && return 0
    fi
  done < <(pom_modules "$agg/pom.xml")
  return 1
}

# 取最外层那个能走到模块的聚合 pom。从最外层跑，命令更接近手敲的样子。
# 都走不到就说明只能进模块目录里跑。
find_aggregator() {
  local target
  target=$(normalize_path "$1")
  local ancestor agg=''
  ancestor=$(parent_dir "$target")
  while [[ -n "$ancestor" && "$ancestor" != "/" ]]; do
    if [[ -f "$ancestor/pom.xml" ]] && can_reach "$ancestor" "$target"; then
      agg=$ancestor
    fi
    ancestor=$(parent_dir "$ancestor")
  done
  [[ -n "$agg" ]] || return 1
  printf '%s\n' "$agg"
}

# 可启动模块的两种判定，谓词拿 pom 路径与模块目录，命中返回 0。
# 「不是 pom 打包」是两者共有的前提，由 each_module 统一排除，谓词里不再重复。
# Boot 模块：引了 spring-boot-maven-plugin，且入口类在自己源码目录里。
is_boot_module() {
  local pom=$1 dir=$2
  [[ -n "${POM_SB_VAL[$pom]:-}" && -n "${HAS_MAIN_CLASS[$dir]:-}" ]]
}

# war 模块：引了 jetty 或 tomcat 插件，且模块目录下有 webapp。
is_war_module() {
  local pom=$1 dir=$2
  [[ -n "${POM_JETTY_VAL[$pom]:-}${POM_TOMCAT_VAL[$pom]:-}" && -n "${HAS_WEBAPP[$dir]:-}" ]]
}

# 遍历全部 pom，把命中判定的模块交给回调。
# 每命中一个调用一次 $2，参数依次是模块目录、id、聚合根、-pl 的值；
# 模块走不到任何聚合根时后两个参数为空。
each_module() {
  local pred=$1 cb=$2 pom dir id agg rel
  for pom in "${POM_LIST[@]}"; do
    [[ -n "${POM_PKG_VAL[$pom]:-}" ]] && continue

    dir=$(parent_dir "$pom")
    "$pred" "$pom" "$dir" || continue

    id=$(project_artifact_id "$pom")
    [[ -n "$id" ]] || id=$(basename "$dir")

    if agg=$(find_aggregator "$dir"); then
      rel="${dir#"$agg"/}"
      "$cb" "$dir" "$id" "$agg" "$rel"
    else
      "$cb" "$dir" "$id" '' ''
    fi
  done
  return 0
}
