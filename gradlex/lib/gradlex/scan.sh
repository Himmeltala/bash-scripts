# Gradle 构建扫描：找构建根，解析 settings 与模块，判定可运行模块与执行任务。
# 数组只在主 shell 里填一次，其余文件只读。
readonly SCAN_SKIP_DIRS=(build .gradle .git .svn node_modules .idea .settings out target)

readonly BOOT_MARKER_RE="org\.springframework\.boot|spring-boot-gradle-plugin|apply[[:space:]]+plugin[[:space:]]*:[[:space:]]*[\"']spring-boot[\"']"
readonly APP_MARKER_RE="id[[:space:]]*\(?[[:space:]]*[\"']application[\"']|apply[[:space:]]+plugin[[:space:]]*:[[:space:]]*[\"']application[\"']|(^|[[:space:]{])application[[:space:]]*[}]?[[:space:]]*$"

# 从 Groovy 与 Kotlin settings 里取 include 的项目路径，去掉前导冒号。
# 支持单行 include 'a', ':b'、include(':a') 与多行 include(...)。
readonly INCLUDE_AWK='
function extract(text,   line, i, q, c, j, s) {
  line = text
  sub(/\/\/.*/, "", line)
  while (1) {
    i = 0
    for (q = 1; q <= length(line); q++) {
      c = substr(line, q, 1)
      if (c == "\047" || c == "\"") { i = q; break }
    }
    if (i == 0) return
    c = substr(line, i, 1)
    j = index(substr(line, i + 1), c)
    if (j == 0) return
    s = substr(line, i + 1, j - 1)
    line = substr(line, i + j + 1)
    sub(/^:/, "", s)
    if (s != "") print s
  }
}
BEGIN { collecting = 0; block = "" }
{
  line = $0
  sub(/^[ \t]+/, "", line)
  if (line ~ /^\/\//) next
  if (collecting) {
    block = block "\n" line
    if (line ~ /\)/) { extract(block); collecting = 0; block = "" }
    next
  }
  if (line ~ /^include[ \t]*\(/) {
    if (line ~ /\)/) extract(line)
    else { collecting = 1; block = line }
    next
  }
  if (line ~ /^include[ \t]+/) extract(line)
}
'

# 取 projectDir 覆盖，输出「项目路径<TAB>目录」。
readonly PROJECTDIR_AWK='
function tokens(text, arr,   line, i, q, c, j, s, n) {
  n = 0; line = text
  sub(/\/\/.*/, "", line)
  while (1) {
    i = 0
    for (q = 1; q <= length(line); q++) {
      c = substr(line, q, 1)
      if (c == "\047" || c == "\"") { i = q; break }
    }
    if (i == 0) break
    c = substr(line, i, 1)
    j = index(substr(line, i + 1), c)
    if (j == 0) break
    n++
    arr[n] = substr(line, i + 1, j - 1)
    line = substr(line, i + j + 1)
  }
  return n
}
/projectDir/ {
  n = tokens($0, t)
  if (n >= 2) {
    name = t[1]; path = t[2]
    sub(/^:/, "", name)
    if (name != "" && path != "") print name "\t" path
  }
}
'

scan_settings_files() {
  local expr=() d
  for d in "${SCAN_SKIP_DIRS[@]}"; do expr+=(-name "$d" -o); done
  expr+=(-false)
  find "$1" \( "${expr[@]}" \) -prune -o -type f \
    \( -name settings.gradle -o -name settings.gradle.kts \) -print 2>/dev/null
}

# 当前目录没有 settings 时，向上找最近的构建根；在子模块目录里执行也能工作。
ancestor_build_root() {
  local d=$1
  while [[ -n "$d" && "$d" != '/' ]]; do
    if [[ -f "$d/settings.gradle" || -f "$d/settings.gradle.kts" ]]; then
      printf '%s\n' "$d"
      return 0
    fi
    d=$(parent_dir "$d")
  done
  return 1
}

settings_file_of() {
  local root=$1
  if [[ -f "$root/settings.gradle" ]]; then
    printf '%s\n' "$root/settings.gradle"
  elif [[ -f "$root/settings.gradle.kts" ]]; then
    printf '%s\n' "$root/settings.gradle.kts"
  else
    return 1
  fi
}

# 构建根列表：当前目录下所有 settings，加上向上找到的最近构建根；都没有则按单项目处理。
prepare_build_roots() {
  local pwd=$1 found=() roots=() f dir ancestor
  mapfile -t found < <(scan_settings_files "$pwd" | sort)
  for f in "${found[@]}"; do
    dir=$(parent_dir "$f")
    roots+=("$dir")
  done

  if ancestor=$(ancestor_build_root "$pwd"); then
    roots+=("$ancestor")
  fi

  if ((${#roots[@]} == 0)); then
    if [[ -f "$pwd/build.gradle" || -f "$pwd/build.gradle.kts" ]]; then
      roots=("$pwd")
    else
      dir=$pwd
      while [[ "$dir" != '/' ]]; do
        dir=$(parent_dir "$dir")
        if [[ -f "$dir/build.gradle" || -f "$dir/build.gradle.kts" ]]; then
          roots=("$dir")
          break
        fi
      done
    fi
  fi

  # 去重，保持顺序。
  local -A seen=()
  BUILD_ROOTS=()
  for dir in "${roots[@]}"; do
    dir=$(normalize_path "$dir")
    [[ -n "${seen[$dir]:-}" ]] && continue
    seen[$dir]=1
    BUILD_ROOTS+=("$dir")
  done
}

# 每个模块在扫描中会被反复查询，先统一解析填进数组，之后只读不写。
declare -a BUILD_ROOTS=()
declare -a MODULE_DIRS=()
declare -A MODULE_ROOT=()
declare -A MODULE_PATH=()
declare -A MODULE_ID=()
declare -A MODULE_RUN_TASK=()
declare -A MODULE_BUILD_TASK=()
declare -A MODULE_KIND=()

add_module() {
  local dir=$1 root=$2 path=$3 id=$4
  dir=$(normalize_path "$dir")
  [[ -n "${MODULE_ROOT[$dir]:-}" ]] && return 0
  MODULE_DIRS+=("$dir")
  MODULE_ROOT[$dir]=$root
  MODULE_PATH[$dir]=$path
  MODULE_ID[$dir]=$id
}

# 模块自己的 build 文件直接应用插件，或构建根的 project(...) / subprojects / allprojects 块里应用。
module_applies_plugin() {
  local dir=$1 root=$2 name=$3 regex=$4 bf
  for bf in "$dir/build.gradle" "$dir/build.gradle.kts"; do
    [[ -f "$bf" ]] || continue
    grep -Eq "$regex" "$bf" && return 0
  done
  [[ -n "$name" ]] || return 1
  for bf in "$root/build.gradle" "$root/build.gradle.kts"; do
    [[ -f "$bf" ]] || continue
    root_block_applies "$bf" "$name" "$regex" && return 0
  done
  return 1
}

# 在构建根 build 文件里找作用到指定模块的块。只认 project("名字")、subprojects、allprojects，
# 顶部的 plugins 块只作用于根项目，不能据此判定所有子模块。
root_block_applies() {
  local file=$1 name=$2 regex=$3 line in_block=0 depth=0 block='' opens closes
  while IFS= read -r line; do
    line=${line%%//*}
    if ((in_block == 0)); then
      if [[ $line =~ project[[:space:]]*\( ]] &&
         { [[ $line == *"\"$name\""* ]] || [[ $line == *"'$name'"* ]] ||
           [[ $line == *"\":$name\""* ]] || [[ $line == *"':$name'"* ]]; }; then
        in_block=1
        depth=0
        block=''
      elif [[ $line =~ (^|[^[:alnum:]_])(subprojects|allprojects)[[:space:]]*[\{] ]]; then
        in_block=1
        depth=0
        block=''
      else
        continue
      fi
    fi

    block+="$line"$'\n'
    opens=${line//[^\{]/}
    closes=${line//[^\}]/}
    depth=$((depth + ${#opens} - ${#closes}))
    if ((depth <= 0)); then
      [[ $block =~ $regex ]] && return 0
      in_block=0
      block=''
    fi
  done < "$file"
  return 1
}

has_boot_main() {
  local dir=$1 d
  for d in "$dir/src/main/java" "$dir/src/main/kotlin"; do
    [[ -d "$d" ]] || continue
    grep -rql --include='*.java' --include='*.kt' '@SpringBootApplication' "$d" 2>/dev/null && return 0
  done
  return 1
}

has_main_method() {
  local dir=$1 d
  for d in "$dir/src/main/java" "$dir/src/main/kotlin"; do
    [[ -d "$d" ]] || continue
    grep -rql --include='*.java' --include='*.kt' -E \
      'static[[:space:]]+void[[:space:]]+main[[:space:]]*\(|fun[[:space:]]+main[[:space:]]*\(' "$d" 2>/dev/null && return 0
  done
  return 1
}

has_declared_main() {
  local dir=$1 bf
  for bf in "$dir/build.gradle" "$dir/build.gradle.kts"; do
    [[ -f "$bf" ]] || continue
    grep -Eq 'mainClass(Name)?[[:space:]]*[=:]' "$bf" && return 0
  done
  return 1
}

# 判定每个模块的任务。Boot 模块优先于 application 模块。
prepare_modules() {
  local root settings name dir override path id
  local -A overrides=()

  MODULE_DIRS=()
  MODULE_ROOT=()
  MODULE_PATH=()
  MODULE_ID=()
  MODULE_RUN_TASK=()
  MODULE_BUILD_TASK=()
  MODULE_KIND=()

  for root in "${BUILD_ROOTS[@]}"; do
    overrides=()
    if settings=$(settings_file_of "$root"); then
      while IFS=$'\t' read -r name path; do
        [[ -n "$name" ]] && overrides[$name]=$path
      done < <(awk "$PROJECTDIR_AWK" "$settings")

      # 根项目也作为候选模块，单项目构建靠它。
      add_module "$root" "$root" '' "$(basename "$root")"

      while IFS= read -r name; do
        [[ -n "$name" ]] || continue
        dir="$root/${name//:/\/}"
        if [[ -n "${overrides[$name]:-}" ]]; then
          override=${overrides[$name]}
          if [[ "$override" == /* ]]; then
            dir=$override
          else
            dir="$root/$override"
          fi
        fi
        [[ -d "$dir" ]] || continue
        id=${name##*:}
        add_module "$dir" "$root" ":$name" "$id"
      done < <(awk "$INCLUDE_AWK" "$settings")
    else
      add_module "$root" "$root" '' "$(basename "$root")"
    fi
  done

  local boot app
  for dir in "${MODULE_DIRS[@]}"; do
    root=${MODULE_ROOT[$dir]}
    path=${MODULE_PATH[$dir]}
    name=${path#:}

    boot=0
    app=0
    module_applies_plugin "$dir" "$root" "$name" "$BOOT_MARKER_RE" && boot=1
    module_applies_plugin "$dir" "$root" "$name" "$APP_MARKER_RE" && app=1

    if ((boot)) && has_boot_main "$dir"; then
      MODULE_KIND[$dir]='boot'
      MODULE_RUN_TASK[$dir]='bootRun'
      MODULE_BUILD_TASK[$dir]='bootJar'
    elif ((app)) && { has_declared_main "$dir" || has_main_method "$dir"; }; then
      MODULE_KIND[$dir]='app'
      MODULE_RUN_TASK[$dir]='run'
      MODULE_BUILD_TASK[$dir]='assemble'
    fi
  done
  return 0
}

prepare_scan() {
  prepare_build_roots "$1"
  prepare_modules
}

is_runnable() {
  [[ -n "${MODULE_RUN_TASK[$1]:-}" ]]
}

is_buildable() {
  [[ -n "${MODULE_BUILD_TASK[$1]:-}" ]]
}

# 遍历全部模块，命中判定就调用回调 $2，参数依次是模块目录、构建根、Gradle 项目路径、标签。
each_module() {
  local pred=$1 cb=$2 dir
  for dir in "${MODULE_DIRS[@]}"; do
    "$pred" "$dir" || continue
    "$cb" "$dir" "${MODULE_ROOT[$dir]}" "${MODULE_PATH[$dir]}" "${MODULE_ID[$dir]}"
  done
  return 0
}
