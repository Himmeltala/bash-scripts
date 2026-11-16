#!/usr/bin/env bash
# 机器接口回归：--list --json 与 exec。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/gradlex-machine.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/bin" "$tmp/proj/src/main/java/demo"
printf '#!/usr/bin/env bash\nprintf "fake-gradle %%s\\n" "$*"\n' > "$tmp/bin/gradle"
chmod +x "$tmp/bin/gradle"
export PATH="$tmp/bin:$PATH"

printf "rootProject.name = 'demo'\n" > "$tmp/proj/settings.gradle"
printf "plugins {\n    id 'org.springframework.boot' version '3.0.0'\n}\n" > "$tmp/proj/build.gradle"
printf 'package demo;\n@SpringBootApplication\npublic class App { public static void main(String[] a) {} }\n' \
  > "$tmp/proj/src/main/java/demo/App.java"

cd "$tmp/proj" || exit 1
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

json=$(bash "$repo/gradlex/bin/gradlex" --list --json run) || fail '列出 run 目标失败'
python3 - "$json" <<'PY' || fail 'run 的 JSON 不对'
import json, sys
data = json.loads(sys.argv[1])
target = data["targets"][0]
assert target["display"] == "gradle bootRun", target
PY

out=$(bash "$repo/gradlex/bin/gradlex" exec --id "run:$(basename "$PWD")" --args '--info') ||
  fail 'exec 执行失败'
[[ "$out" == *'bootRun --info'* ]] || fail "exec 参数没带上：$out"

bash "$repo/gradlex/bin/gradlex" exec --id run:nope >/dev/null 2>&1
[[ $? -eq 2 ]] || fail '未知 id 应以用法错误退出'

printf 'ok - gradlex 机器接口\n'
