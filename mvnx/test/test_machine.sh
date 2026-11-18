#!/usr/bin/env bash
# 机器接口回归：--list --json 的目标、空列表，exec 的执行与错误码。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/mvnx-machine.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/bin" "$tmp/proj/src/main/java/demo"
printf '#!/usr/bin/env bash\nprintf "fake-mvn %%s\\n" "$*"\n' > "$tmp/bin/mvn"
chmod +x "$tmp/bin/mvn"
export PATH="$tmp/bin:$PATH"

cat > "$tmp/proj/pom.xml" <<'EOF'
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>demo-app</artifactId>
  <version>1.0</version>
  <packaging>jar</packaging>
  <build><plugins><plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
  </plugin></plugins></build>
</project>
EOF
printf 'package demo;\n@SpringBootApplication\npublic class App { public static void main(String[] a) {} }\n' \
  > "$tmp/proj/src/main/java/demo/App.java"

cd "$tmp/proj" || exit 1
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

json=$(bash "$repo/mvnx/bin/mvnx" --list --json run) || fail '列出 run 目标失败'
python3 - "$json" <<'PY' || fail 'run 的 JSON 不对'
import json, sys
data = json.loads(sys.argv[1])
assert data["command"] == "run"
target = data["targets"][0]
assert target["id"] == "run:demo-app", target
assert target["display"] == "mvn spring-boot:run", target
PY

empty=$(bash "$repo/mvnx/bin/mvnx" --list --json war) || fail '没有 war 目标时应正常返回'
python3 - "$empty" <<'PY' || fail '空列表 JSON 不对'
import json, sys
assert json.loads(sys.argv[1])["targets"] == []
PY

out=$(bash "$repo/mvnx/bin/mvnx" exec --id run:demo-app --args '-Dfoo=bar') || fail 'exec 执行失败'
[[ "$out" == *'spring-boot:run -Dfoo=bar'* ]] || fail "exec 参数没带上：$out"

bash "$repo/mvnx/bin/mvnx" exec --id run:nope >/dev/null 2>&1
[[ $? -eq 2 ]] || fail '未知 id 应以用法错误退出'

# war 目标：jetty 的各种版本、tomcat7 与 cargo 插件，以及被配置改过的 web 根。
write_war_pom() {
  local dir=$1 artifact=$2 extra=$3
  mkdir -p "$dir"
  cat > "$dir/pom.xml" <<EOF
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>$(basename "$dir")</artifactId>
  <version>1.0</version>
  <packaging>war</packaging>
  <build><plugins><plugin>
    <artifactId>$artifact</artifactId>
    $extra
  </plugin></plugins></build>
</project>
EOF
}

expect_war() {
  local dir=$1 want=$2 name=$3 out
  out=$(cd "$dir" && bash "$repo/mvnx/bin/mvnx" --list --json war) || fail "$name：列出 war 目标失败"
  python3 - "$out" "$want" "$name" <<'PY' || fail "$name：JSON 不对"
import json, sys
data = json.loads(sys.argv[1])
targets = data["targets"]
assert len(targets) == 1, targets
assert targets[0]["display"] == sys.argv[2], targets
PY
}

write_war_pom "$tmp/war/tomcat7" 'tomcat7-maven-plugin' ''
mkdir -p "$tmp/war/tomcat7/src/main/webapp"
expect_war "$tmp/war/tomcat7" 'mvn tomcat7:run' 'tomcat7'

write_war_pom "$tmp/war/jetty-ee10" 'jetty-ee10-maven-plugin' ''
mkdir -p "$tmp/war/jetty-ee10/src/main/webapp"
expect_war "$tmp/war/jetty-ee10" 'mvn jetty:run' 'jetty-ee10'

write_war_pom "$tmp/war/cargo" 'cargo-maven3-plugin' ''
mkdir -p "$tmp/war/cargo/src/main/webapp"
expect_war "$tmp/war/cargo" 'mvn cargo:run' 'cargo'

# web 根改到 web/，没有 src/main/webapp 也认。
write_war_pom "$tmp/war/custom" 'jetty-maven-plugin' \
  '<configuration><webAppSourceDirectory>web</webAppSourceDirectory></configuration>'
mkdir -p "$tmp/war/custom/web"
expect_war "$tmp/war/custom" 'mvn jetty:run' '自定义 web 根'

# 插件声明了却既没有 webapp 也没有配置，不列目标。
write_war_pom "$tmp/war/noweb" 'jetty-maven-plugin' ''
out=$(cd "$tmp/war/noweb" && bash "$repo/mvnx/bin/mvnx" --list --json war) || fail '无 webapp 时列出失败'
[[ "$out" == *'"targets":[]'* ]] || fail "没有 webapp 不该列目标：$out"

# 同时声明 jetty 与 tomcat7 时仍按 jetty 执行，且只出现一条。
mkdir -p "$tmp/war/both/src/main/webapp"
cat > "$tmp/war/both/pom.xml" <<'EOF'
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>both</artifactId>
  <version>1.0</version>
  <packaging>war</packaging>
  <build><plugins>
    <plugin><artifactId>jetty-maven-plugin</artifactId></plugin>
    <plugin><artifactId>tomcat7-maven-plugin</artifactId></plugin>
  </plugins></build>
</project>
EOF
expect_war "$tmp/war/both" 'mvn jetty:run' 'jetty 优先'

# 自动判编译：只有源码与构建入口都没更新时才跳过；多语言源码、wrapper、.mvn 的改动都要算进来。
mkdir -p "$tmp/compile/src/main/java/demo" "$tmp/compile/target/classes/demo"
cat > "$tmp/compile/pom.xml" <<'EOF'
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>compile-demo</artifactId>
  <version>1.0</version>
  <build><plugins><plugin>
    <artifactId>spring-boot-maven-plugin</artifactId>
  </plugin></plugins></build>
</project>
EOF
printf 'package demo;\n@SpringBootApplication\npublic class App { public static void main(String[] a) {} }\n' \
  > "$tmp/compile/src/main/java/demo/App.java"
touch -d '2020-01-01 00:00:00' "$tmp/compile/pom.xml" "$tmp/compile/src/main/java/demo/App.java"
: > "$tmp/compile/target/classes/demo/App.class"
touch -d '2020-06-01 00:00:00' "$tmp/compile/target/classes/demo/App.class"

run_auto() { ( cd "$tmp/compile" && bash "$repo/mvnx/bin/mvnx" exec --id run:compile-demo --mode auto ); }

out=$(run_auto 2>/dev/null) || fail '自动模式执行失败'
[[ "$out" == *'maven.main.skip=true'* ]] || fail "源码未更新应跳过编译：$out"

mkdir -p "$tmp/compile/src/main/kotlin/demo"
printf 'class Foo\n' > "$tmp/compile/src/main/kotlin/demo/Foo.kt"
touch -d '2020-07-01 00:00:00' "$tmp/compile/src/main/kotlin/demo/Foo.kt"
out=$(run_auto 2>/dev/null) || fail 'Kotlin 改动后执行失败'
[[ "$out" != *'maven.main.skip'* ]] || fail "Kotlin 改动应触发编译：$out"
touch -d '2020-01-01 00:00:00' "$tmp/compile/src/main/kotlin/demo/Foo.kt"

printf '#!/bin/sh\n' > "$tmp/compile/mvnw"
touch -d '2020-07-01 00:00:00' "$tmp/compile/mvnw"
out=$(run_auto 2>/dev/null) || fail 'wrapper 改动后执行失败'
[[ "$out" != *'maven.main.skip'* ]] || fail "wrapper 改动应触发编译：$out"
touch -d '2020-01-01 00:00:00' "$tmp/compile/mvnw"

mkdir -p "$tmp/compile/.mvn"
printf -- '-T 1C\n' > "$tmp/compile/.mvn/maven.config"
touch -d '2020-07-01 00:00:00' "$tmp/compile/.mvn/maven.config"
out=$(run_auto 2>/dev/null) || fail '.mvn 改动后执行失败'
[[ "$out" != *'maven.main.skip'* ]] || fail ".mvn 改动应触发编译：$out"
touch -d '2020-01-01 00:00:00' "$tmp/compile/.mvn/maven.config"

out=$(run_auto 2>/dev/null) || fail '恢复后执行失败'
[[ "$out" == *'maven.main.skip=true'* ]] || fail "全部恢复后应重新跳过编译：$out"

# 跳过编译要求模块里确实有 class：有 class 放行，空目录按没编过拒绝。
out=$(cd "$tmp/compile" && bash "$repo/mvnx/bin/mvnx" exec --id run:compile-demo --mode no-compile 2>/dev/null) ||
  fail '已有 class 时跳过编译应能执行'
[[ "$out" == *'maven.main.skip=true'* ]] || fail "跳过编译没有带上跳过参数：$out"

mkdir -p "$tmp/noclass/target/classes"
cp "$tmp/compile/pom.xml" "$tmp/noclass/pom.xml"
( cd "$tmp/noclass" && bash "$repo/mvnx/bin/mvnx" exec --id run:compile-demo --mode no-compile ) >/dev/null 2>&1
[[ $? -eq 2 ]] || fail '空 target/classes 应以用法错误退出'

printf 'ok - mvnx 机器接口\n'
