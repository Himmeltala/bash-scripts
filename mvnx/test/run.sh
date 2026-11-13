#!/usr/bin/env bash
# mvnx 迁移回归：确认不再保留自定义编号清单，命令仍能加载。
set -uo pipefail
repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

if grep -q 'mvnx_plain_checklist' "$repo/mvnx/lib/mvnx/ui.sh"; then
  bad '仍保留自定义编号清单'
else
  ok '已删除自定义编号清单'
fi


# 记录六列：标签去重只换第一列，工作目录、工具自己的两列、展示路径与命令都原样保留。
rec() {
  local IFS=$'\x1f'
  printf '%s\n' "$*"
}

records=$(rec web /w/a '' '' a/web 'mvn -pl a'; rec web /w/b '' '' b/web 'mvn -pl b')
expected=$(rec 'web@a/web' /w/a '' '' a/web 'mvn -pl a'; rec 'web@b/web' /w/b '' '' b/web 'mvn -pl b')
got=$(printf '%s\n' "$records" | bash -c 'source "$1/mvnx/lib/mvnx-core.sh"; assign_tags' _ "$repo")
[[ "$got" == "$expected" ]] && ok '标签去重后记录仍是六列' || bad '标签去重改动了记录'

# 勾选结果按标签映射回整条记录，执行时不用再猜字段。
one=$(rec web /w/a '' '' a/web 'mvn -pl a')
got=$(printf '1\n' | bash -c 'source "$1/mvnx/lib/mvnx-core.sh"; UI_MODE=0; mvnx_ui_checklist 模块 "$2"' _ "$repo" "$one" 2>/dev/null)
[[ "$got" == "$one" ]] && ok '勾选结果映射回整条记录' || bad '勾选结果丢了记录字段'

# 终端探测、暂停与空选判断都在 bash-tui，本地不再各写一份。
if grep -rq 'detect_ui_mode\|ui_available() {' "$repo/mvnx/lib"; then
  bad '仍自带终端探测或 ui_available'
else
  ok '终端探测交给 bash-tui'
fi

python3 "$repo/mvnx/test/test_web_alias.py" >/dev/null 2>&1 || bad '网页工作区别名的测试未通过'
python3 "$repo/mvnx/test/test_web_jdk.py" >/dev/null 2>&1 || bad '网页按工作区选 JDK 的测试未通过'
python3 "$repo/mvnx/test/test_web_log.py" >/dev/null 2>&1 || bad '网页日志 SSE 的测试未通过'
python3 "$repo/mvnx/test/test_web_metrics.py" >/dev/null 2>&1 || bad '网页指标 SSE 的测试未通过'
python3 "$repo/mvnx/test/test_web_state.py" >/dev/null 2>&1 || bad '网页状态 SSE 的测试未通过'
python3 "$repo/mvnx/test/test_web_start.py" >/dev/null 2>&1 || bad '网页启动没有带上模块的测试未通过'

"$repo/mvnx/bin/mvnx" --help >/dev/null 2>&1 || bad 'mvnx --help 失败'
((fail)) && exit 1
printf '全部通过\n'
