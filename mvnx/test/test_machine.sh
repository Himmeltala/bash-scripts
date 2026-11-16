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

printf 'ok - mvnx 机器接口\n'
