#!/usr/bin/env bash
# nodex 回归：临时 Node 工作区下的扫描、包管理器判定、动作清单与网页引擎状态。
set -uo pipefail
repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
nodex="$repo/nodex/bin/nodex"
FS=$'\x1f'
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 一个 pnpm 工作区：a 有 dev 与 build，b 只有 build，c 没有脚本，另外藏一个依赖目录。
multi="$tmp/multi"
mkdir -p "$multi/packages/a/node_modules/fake" "$multi/packages/b" "$multi/packages/c"
cat >"$multi/package.json" <<'EOF'
{"name":"demo-root","private":true,"workspaces":["packages/*"]}
EOF
cat >"$multi/packages/a/package.json" <<'EOF'
{"name":"@demo/a","scripts":{"dev":"vite","build":"vite build"}}
EOF
cat >"$multi/packages/b/package.json" <<'EOF'
{"name":"@demo/b","scripts":{"build":"tsc"}}
EOF
cat >"$multi/packages/c/package.json" <<'EOF'
{"name":"@demo/c"}
EOF
cat >"$multi/packages/a/node_modules/fake/package.json" <<'EOF'
{"name":"fake","scripts":{"dev":"nope","build":"nope"}}
EOF
: >"$multi/pnpm-lock.yaml"

out=$(cd "$multi" && "$nodex" --list dev)
grep -q '^@demo/a .*pnpm run dev$' <<<"$out" && ok 'dev 列到有 dev 脚本的包' || bad 'dev 漏了 @demo/a'
grep -q 'fake' <<<"$out" && bad 'dev 扫进了 node_modules' || ok 'node_modules 不参与扫描'

out=$(cd "$multi" && "$nodex" --list build)
grep -q '^@demo/a .*pnpm run build$' <<<"$out" && grep -q '^@demo/b .*pnpm run build$' <<<"$out" &&
  ok 'build 列出两个包' || bad 'build 清单不对'
grep -q '@demo/c' <<<"$out" && bad '没有 build 脚本的包出现在打包里' || ok '没有 build 脚本的包不进打包'

out=$(cd "$multi" && "$nodex" --list install)
grep -q '^demo-root .*pnpm install$' <<<"$out" && ok '安装有工作区根一行' || bad '安装缺工作区根'
grep -q '^@demo/a .*pnpm --filter @demo/a install$' <<<"$out" && ok '子包按 pnpm 选择器安装' || bad 'pnpm 子包安装命令不对'
grep -q '^@demo/c ' <<<"$out" && ok '没有脚本的包也能装依赖' || bad '安装漏了没有脚本的包'

# 从子包目录执行时只认最近的 package.json。
out=$(cd "$multi/packages/a" && "$nodex" --list dev)
lines=$(wc -l <<<"$out")
[[ "$lines" == 1 ]] && grep -q '^@demo/a .*pnpm run dev$' <<<"$out" &&
  ok '子目录里只看当前包，包管理器仍按工作区根' || bad '子目录扫描范围或包管理器不对'

# 单包工程：根自己就是唯一的包，没有工作区选择器。
single="$tmp/single"
mkdir -p "$single"
printf '{"name":"solo","scripts":{"dev":"node .","build":"tsc"}}\n' >"$single/package.json"
out=$(cd "$single" && "$nodex" --list dev)
grep -q '^solo .*npm run dev$' <<<"$out" && ok '单包工程按 npm 执行' || bad '单包工程启动命令不对'
out=$(cd "$single" && "$nodex" --list install)
grep -q '^solo .*npm install$' <<<"$out" && ok '单包工程安装只有一行' || bad '单包工程安装清单不对'

# packageManager 字段优先于锁文件。
field="$tmp/field"
mkdir -p "$field"
printf '{"name":"field","packageManager":"yarn@1.22.22","workspaces":["pkgs/*"]}\n' >"$field/package.json"
mkdir -p "$field/pkgs/x"
printf '{"name":"@f/x","scripts":{"dev":"start"}}\n' >"$field/pkgs/x/package.json"
: >"$field/package-lock.json"
out=$(cd "$field" && "$nodex" --list dev)
grep -q 'yarn run dev' <<<"$out" && ok 'packageManager 字段优先' || bad 'packageManager 没有被采用'

# node_modules 的安装痕迹优先于锁文件：留着 yarn.lock，依赖却是 npm 装的。
marker="$tmp/marker"
mkdir -p "$marker/node_modules"
printf '{"name":"marker","scripts":{"dev":"serve"}}\n' >"$marker/package.json"
: >"$marker/yarn.lock"
: >"$marker/node_modules/.package-lock.json"
out=$(cd "$marker" && "$nodex" --list dev)
grep -q 'npm run dev' <<<"$out" && ok 'node_modules 痕迹优先于锁文件' || bad '锁文件盖过了实际安装痕迹'

# 作者明写的 packageManager 字段仍排在安装痕迹之前。
field2="$tmp/field2"
mkdir -p "$field2/node_modules"
printf '{"name":"field2","packageManager":"pnpm@9.0.0","scripts":{"dev":"serve"}}\n' >"$field2/package.json"
: >"$field2/node_modules/.yarn-integrity"
out=$(cd "$field2" && "$nodex" --list dev)
grep -q '^field2 .*pnpm run dev$' <<<"$out" && ok 'packageManager 字段压过安装痕迹' || bad '字段没有压过安装痕迹'

# 排除模式与 pnpm-workspace.yaml。
neg="$tmp/neg"
mkdir -p "$neg/apps/keep" "$neg/apps/skip"
printf '{"name":"neg"}\n' >"$neg/package.json"
printf "packages:\n  - 'apps/*'\n  - '!apps/skip'\n" >"$neg/pnpm-workspace.yaml"
printf '{"name":"keep","scripts":{"build":"b"}}\n' >"$neg/apps/keep/package.json"
printf '{"name":"skip","scripts":{"build":"b"}}\n' >"$neg/apps/skip/package.json"
out=$(cd "$neg" && "$nodex" --list build)
grep -q '^keep ' <<<"$out" && ! grep -q '^skip ' <<<"$out" && ok '排除模式生效' || bad '排除模式没生效'

# 网页引擎：add 之后状态文件里要有 ws、svc 与 pkg 行。
cache="$tmp/cache"
mkdir -p "$cache"
printf 'hello\x1f1\nreqfrom\x1fadd\x1f%s\nreqfrom\x1ftick\n' "$multi" |
  XDG_CACHE_HOME="$cache" bash -c 'source "$1/nodex/lib/nodex-core.sh"; web_engine' _ "$repo" >/dev/null 2>&1
state="$cache/nodex/web/state.tsv"
[[ -f "$state" ]] && ok '引擎写出状态文件' || bad '引擎没有写状态文件'
grep -q "^ws${FS}" "$state" && ok '状态里有工作区' || bad '状态缺工作区'
grep -q "^svc${FS}.*${FS}dev${FS}" "$state" && ok '状态里有启动服务' || bad '状态缺启动服务'
grep -q "^pkg${FS}" "$state" && ok '状态里有包清单' || bad '状态缺包清单'

python3 "$repo/nodex/test/test_web_node.py" >/dev/null 2>&1 || bad '网页工作区与别名的测试未通过'

"$nodex" --help >/dev/null 2>&1 && ok '--help 正常' || bad '--help 失败'

((fail)) && exit 1
printf '全部通过\n'
