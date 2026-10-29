#!/usr/bin/env bash
# gradlex 回归测试：在临时目录构造 Gradle 工程，验证扫描、目标判定与 Gradle 入口选择。
set -euo pipefail

here=${BASH_SOURCE[0]%/*}
[[ "$here" == "${BASH_SOURCE[0]}" ]] && here='.'
repo=$(cd "$here/../.." && pwd)
bin="$repo/gradlex/bin/gradlex"
core="$repo/gradlex/lib/gradlex-core.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail=0
check_has() {
  local name=$1 file=$2 needle=$3
  if grep -Fq -- "$needle" "$file"; then
    printf 'ok   %s\n' "$name"
  else
    printf 'FAIL %s: 输出里没有 %s\n' "$name" "$needle" >&2
    cat "$file" >&2
    fail=1
  fi
}

check_not() {
  local name=$1 file=$2 needle=$3
  if grep -Fq -- "$needle" "$file"; then
    printf 'FAIL %s: 输出里不该出现 %s\n' "$name" "$needle" >&2
    cat "$file" >&2
    fail=1
  else
    printf 'ok   %s\n' "$name"
  fi
}

make_java_app() {
  local dir=$1 class=$2 anno=$3
  mkdir -p "$dir/src/main/java"
  {
    printf 'package demo;\n'
    [[ "$anno" == boot ]] && printf '@SpringBootApplication\n'
    printf 'public class %s { public static void main(String[] a) {} }\n' "$class"
  } > "$dir/src/main/java/$class.java"
}

# 1. Groovy 多项目：模块 build 文件声明插件，纯库模块不出现。
mkdir -p "$tmp/groovy"
cat > "$tmp/groovy/settings.gradle" <<'EOF'
rootProject.name = 'groovy-demo'
include 'app', ':lib'
include(
  ':worker'
)
EOF
mkdir -p "$tmp/groovy/app" "$tmp/groovy/lib" "$tmp/groovy/worker"
printf "plugins { id 'org.springframework.boot' version '2.7.0' }\n" > "$tmp/groovy/app/build.gradle"
printf "plugins { id 'java' }\n" > "$tmp/groovy/lib/build.gradle"
printf "plugins { id 'application' }\n" > "$tmp/groovy/worker/build.gradle"
make_java_app "$tmp/groovy/app" App boot
make_java_app "$tmp/groovy/lib" Lib ''
make_java_app "$tmp/groovy/worker" Worker ''

( cd "$tmp/groovy" && "$bin" --list ) > "$tmp/groovy.out"
check_has 'groovy: Boot 模块进入清单' "$tmp/groovy.out" 'app'
check_has 'groovy: application 模块进入清单' "$tmp/groovy.out" 'worker'
check_not 'groovy: 纯库模块不进入清单' "$tmp/groovy.out" 'lib'

( cd "$tmp/groovy" && "$bin" --list ) > "$tmp/groovy-run.out"
check_has 'groovy: Boot 任务' "$tmp/groovy-run.out" ':app:bootRun'
check_has 'groovy: application 任务' "$tmp/groovy-run.out" ':worker:run'

( cd "$tmp/groovy" && "$bin" build --list ) > "$tmp/groovy-build.out"
check_has 'groovy: build 任务' "$tmp/groovy-build.out" ':app:bootJar'
check_has 'groovy: assemble 任务' "$tmp/groovy-build.out" ':worker:assemble'

# 2. 构建根 project(...) 块里应用插件。
mkdir -p "$tmp/rootblock"
cat > "$tmp/rootblock/settings.gradle" <<'EOF'
include ':svc'
EOF
cat > "$tmp/rootblock/build.gradle" <<'EOF'
project(":svc") {
    apply plugin: 'org.springframework.boot'
}
EOF
mkdir -p "$tmp/rootblock/svc"
printf "plugins { id 'java' }\n" > "$tmp/rootblock/svc/build.gradle"
make_java_app "$tmp/rootblock/svc" SvcApp boot
( cd "$tmp/rootblock" && "$bin" --list ) > "$tmp/rootblock.out"
check_has 'rootblock: project(...) 块识别' "$tmp/rootblock.out" ':svc:bootRun'

# 3. subprojects 块统一应用插件。
mkdir -p "$tmp/subprojects"
printf "include 'a', 'b'\n" > "$tmp/subprojects/settings.gradle"
cat > "$tmp/subprojects/build.gradle" <<'EOF'
subprojects {
    apply plugin: 'org.springframework.boot'
}
EOF
mkdir -p "$tmp/subprojects/a" "$tmp/subprojects/b"
make_java_app "$tmp/subprojects/a" AApp boot
make_java_app "$tmp/subprojects/b" BApp boot
( cd "$tmp/subprojects" && "$bin" --list ) > "$tmp/subprojects.out"
check_has 'subprojects: 模块 a' "$tmp/subprojects.out" ':a:bootRun'
check_has 'subprojects: 模块 b' "$tmp/subprojects.out" ':b:bootRun'

# 4. Kotlin DSL 与 projectDir 覆盖。
mkdir -p "$tmp/kotlin"
cat > "$tmp/kotlin/settings.gradle.kts" <<'EOF'
rootProject.name = "kotlin-demo"
include(":tool", ":svc")
project(":svc").projectDir = file("modules/svc")
EOF
mkdir -p "$tmp/kotlin/tool" "$tmp/kotlin/modules/svc"
printf 'plugins { application }\n' > "$tmp/kotlin/tool/build.gradle.kts"
printf 'plugins { id("org.springframework.boot") version "3.0.0" }\n' > "$tmp/kotlin/modules/svc/build.gradle.kts"
mkdir -p "$tmp/kotlin/tool/src/main/kotlin" "$tmp/kotlin/modules/svc/src/main/kotlin"
printf 'fun main() {}\n' > "$tmp/kotlin/tool/src/main/kotlin/Main.kt"
printf '@SpringBootApplication\nclass Svc\n' > "$tmp/kotlin/modules/svc/src/main/kotlin/Svc.kt"
( cd "$tmp/kotlin" && "$bin" --list ) > "$tmp/kotlin.out"
check_has 'kotlin: application 模块' "$tmp/kotlin.out" ':tool:run'
check_has 'kotlin: projectDir 覆盖' "$tmp/kotlin.out" ':svc:bootRun'

# 5. 没有 settings 的单项目。
mkdir -p "$tmp/single"
printf "plugins { id 'org.springframework.boot' version '2.7.0' }\n" > "$tmp/single/build.gradle"
make_java_app "$tmp/single" SingleApp boot
( cd "$tmp/single" && "$bin" --list ) > "$tmp/single.out"
check_has 'single: 单项目' "$tmp/single.out" 'bootRun'

# 6. Gradle 入口选择：gradlew 优先，其次系统 gradle，GRADLEX_GRADLE 最优先。
mkdir -p "$tmp/wrap/sub"
printf '#!/bin/sh\n' > "$tmp/wrap/gradlew"
chmod +x "$tmp/wrap/gradlew"

out=$( source "$core"; find_wrapper "$tmp/wrap/sub" )
[[ "$out" == "$tmp/wrap/gradlew" ]] && printf 'ok   wrapper: 向上查找\n' ||
  { printf 'FAIL wrapper: 得到 %s\n' "$out" >&2; fail=1; }

chmod -x "$tmp/wrap/gradlew"
out=$( source "$core"; build_gradle_argv "$tmp/wrap/sub"; printf '%s\n' "${GRADLE_CMD[*]}" )
[[ "$out" == "sh $tmp/wrap/gradlew" ]] && printf 'ok   wrapper: 不可执行时用 sh\n' ||
  { printf 'FAIL wrapper: 得到 %s\n' "$out" >&2; fail=1; }

out=$( source "$core"; GRADLEX_GRADLE=/opt/gradle/bin/gradle build_gradle_argv /; printf '%s\n' "${GRADLE_CMD[*]}" )
[[ "$out" == '/opt/gradle/bin/gradle' ]] && printf 'ok   wrapper: GRADLEX_GRADLE 优先\n' ||
  { printf 'FAIL wrapper: 得到 %s\n' "$out" >&2; fail=1; }

# CRLF 的 gradlew 在 Linux 上跑不起来，应警告并改用系统 gradle。
mkdir -p "$tmp/crlf" "$tmp/crlffake"
printf '#!/bin/sh\r\n' > "$tmp/crlf/gradlew"
printf '#!/bin/sh\n' > "$tmp/crlffake/gradle"
chmod +x "$tmp/crlffake/gradle"
out=$( source "$core"; PATH="$tmp/crlffake:$PATH" build_gradle_argv "$tmp/crlf" 2>/dev/null; printf '%s\n' "${GRADLE_CMD[*]}" )
[[ "$out" == 'gradle' ]] && printf 'ok   wrapper: CRLF 时回退系统 gradle\n' ||
  { printf 'FAIL wrapper: 得到 %s\n' "$out" >&2; fail=1; }

# 7. --rebuild 与 --refresh 拼进展示命令。
( cd "$tmp/groovy" && "$bin" --list --rebuild --refresh ) > "$tmp/flags.out"
check_has 'flags: clean' "$tmp/flags.out" ':app:clean :app:bootRun'
check_has 'flags: 刷新依赖' "$tmp/flags.out" '--refresh-dependencies'

# 8. 无终端时编号选择，并用假 gradle 验证真正传给 Gradle 的参数。
mkdir -p "$tmp/fakebin"
cat > "$tmp/fakebin/gradle" <<'EOF'
#!/bin/sh
printf 'FAKE'
for a in "$@"; do printf ' [%s]' "$a"; done
printf '\n'
EOF
chmod +x "$tmp/fakebin/gradle"

unset GRADLEX_GRADLE
out=$( printf '1\n' | ( cd "$tmp/groovy" && PATH="$tmp/fakebin:$PATH" "$bin" run ) 2>/dev/null )
[[ "$out" == 'FAKE [:app:bootRun]' ]] && printf 'ok   exec: 默认任务\n' ||
  { printf 'FAIL exec: 得到 %s\n' "$out" >&2; fail=1; }

out=$( printf '1\n' | ( cd "$tmp/groovy" && PATH="$tmp/fakebin:$PATH" "$bin" run --rebuild --refresh ) 2>/dev/null )
[[ "$out" == 'FAKE [:app:clean] [:app:bootRun] [--refresh-dependencies]' ]] &&
  printf 'ok   exec: rebuild 与 refresh\n' ||
  { printf 'FAIL exec: 得到 %s\n' "$out" >&2; fail=1; }

if ((fail)); then
  printf '\n有测试失败\n' >&2
  exit 1
fi
printf '\n全部通过\n'
