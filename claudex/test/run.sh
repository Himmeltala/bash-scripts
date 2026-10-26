#!/usr/bin/env bash
# 在临时 HOME 里造假的 ~/.claude 树，验证列表、归档、恢复、删除与缓存清理。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
bin="$repo/claudex/bin/claudex"
tmp=$(mktemp -d "${TMPDIR:-/tmp}/claudex-test.XXXXXX")
home="$tmp/home"
work1="$tmp/work/proj-a"
work2="$tmp/work/proj-b"
archive="$tmp/archive"
mkdir -p "$home/.claude/projects/-tmp-work-proj-a" \
  "$home/.claude/projects/-tmp-work-proj-b" \
  "$home/.claude/sessions" "$home/.claude/shell-snapshots" \
  "$home/.claude/paste-cache" "$home/.claude/file-history" \
  "$home/.claude/session-env" "$home/.claude/plugins/cache" \
  "$work1" "$work2" "$archive" "$tmp/bin"
export HOME="$home"
export CLAUDEX_ARCHIVE_DIR="$archive"
export PATH="$tmp/bin:$PATH"

s1=11111111-aaaa-bbbb-cccc-111111111111
s2=22222222-aaaa-bbbb-cccc-222222222222
s3=33333333-aaaa-bbbb-cccc-333333333333
p1="$home/.claude/projects/-tmp-work-proj-a"
p2="$home/.claude/projects/-tmp-work-proj-b"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
ok() { printf 'ok - %s\n' "$*"; }

make_session() {
  local dir=$1 id=$2 cwd=$3 title=$4 old=$5
  printf '{"type":"user","cwd":"%s","message":{"role":"user","content":"hi"}}\n' "$cwd" >"$dir/$id.jsonl"
  printf '{"type":"ai-title","aiTitle":"%s","sessionId":"%s"}\n' "$title" "$id" >>"$dir/$id.jsonl"
  if [[ -n $old ]]; then
    touch -d "$old" "$dir/$id.jsonl"
  fi
}

make_session "$p1" "$s1" "$work1" '旧会话' '40 days ago'
make_session "$p1" "$s2" "$work1" '新会话' ''
make_session "$p2" "$s3" "$work2" '运行中会话' ''
mkdir -p "$p1/$s1/tool-results" "$home/.claude/file-history/$s1" \
  "$home/.claude/session-env/$s1" "$p1/memory" "$home/.claude/file-history/$s3"
printf 'tool output\n' >"$p1/$s1/tool-results/t.txt"
printf 'history\n' >"$home/.claude/file-history/$s1/h@v1"
printf 'memory\n' >"$p1/memory/MEMORY.md"

# 造一个命令行含 claude 的存活进程，验证运行中保护。
bash -c 'exec -a claude sleep 30' &
active_pid=$!
sleep 0.3
printf '{"pid":%s,"sessionId":"%s"}\n' "$active_pid" "$s3" >"$home/.claude/sessions/$active_pid.json"

# 假 claude，只记录 cwd 与参数，验证 resume 的目录切换。
cat >"$tmp/bin/claude" <<'EOF'
#!/usr/bin/env bash
printf 'cwd=%s args=%s\n' "$PWD" "$*" >"$HOME/claude-seen"
EOF
chmod +x "$tmp/bin/claude"

run() { HOME="$home" CLAUDEX_ARCHIVE_DIR="$archive" "$bin" "$@"; }

out=$(cd "$work1" && run list)
grep -q "$s1" <<<"$out" || fail '当前项目列表缺少 s1'
grep -q "$s2" <<<"$out" || fail '当前项目列表缺少 s2'
grep -q "$s3" <<<"$out" && fail '当前项目列表混入了别的项目'
ok '当前项目列表'

out=$(run list --all)
for id in "$s1" "$s2" "$s3"; do grep -q "$id" <<<"$out" || fail "全部列表缺少 $id"; done
grep -q '运行中' <<<"$out" || fail '列表没有标出运行中会话'
ok '全部项目列表与运行中标记'

out=$(run list --all --older-than 30)
grep -q "$s1" <<<"$out" || fail '天数过滤漏掉旧会话'
grep -q "$s2" <<<"$out" && fail '天数过滤混入新会话'
ok '天数过滤'

out=$(cd "$work1" && run resume "$s1")
[[ -f "$home/claude-seen" ]] || fail 'resume 没有调用 claude'
grep -q "cwd=$work1" "$home/claude-seen" || fail 'resume 没有切到原目录'
grep -q -- "--resume $s1" "$home/claude-seen" || fail 'resume 参数不对'
rm -f "$home/claude-seen"
ok 'resume 目录与参数'

run archive "$s1" >/dev/null 2>&1
[[ -f "$p1/$s1.jsonl" ]] || fail '预览归档就移走了正文'
ok '归档预览不动盘'

run archive "$s1" --yes || fail '归档失败'
[[ ! -e "$p1/$s1.jsonl" ]] || fail '归档后正文还在'
adir=$(find "$archive" -mindepth 2 -maxdepth 2 -type d -name "$s1")
[[ -n $adir ]] || fail '归档目录不存在'
for part in session.jsonl session file-history session-env meta title; do
  [[ -e "$adir/$part" ]] || fail "归档缺少 $part"
done
ok '归档移动四块数据'

out=$(run archives)
grep -q "$s1" <<<"$out" || fail 'archives 没列出条目'
ok '归档列表'

run restore "$s1" --yes || fail '恢复归档失败'
[[ -f "$p1/$s1.jsonl" ]] || fail '恢复后正文没回去'
[[ -d "$p1/$s1/tool-results" ]] || fail '恢复后会话目录没回去'
[[ -d "$home/.claude/file-history/$s1" ]] || fail '恢复后文件历史没回去'
[[ -d "$home/.claude/session-env/$s1" ]] || fail '恢复后会话环境没回去'
ok '恢复归档'

run delete "$s3" --yes >/dev/null 2>&1 && fail '删除了运行中的会话'
[[ -f "$p2/$s3.jsonl" ]] || fail '运行中会话被删了'
ok '运行中会话受保护'

mkdir -p "$p1/$s2/tool-results" "$home/.claude/file-history/$s2" "$home/.claude/session-env/$s2"
printf 'x\n' >"$p1/$s2/tool-results/x.txt"
run delete "$s2" --yes || fail '删除会话失败'
[[ ! -e "$p1/$s2.jsonl" && ! -e "$p1/$s2" && ! -e "$home/.claude/file-history/$s2" && ! -e "$home/.claude/session-env/$s2" ]] \
  || fail '删除后仍有会话数据'
[[ -d "$p1/memory" && -f "$p1/memory/MEMORY.md" ]] || fail '删除误伤 memory'
ok '删除四块数据并保留 memory'

printf 'old\n' >"$home/.claude/shell-snapshots/snapshot-bash-1-aaa.sh"
printf 'new\n' >"$home/.claude/shell-snapshots/snapshot-bash-2-bbb.sh"
printf 'old\n' >"$home/.claude/paste-cache/old.txt"
printf 'new\n' >"$home/.claude/paste-cache/new.txt"
touch -d '10 days ago' "$home/.claude/shell-snapshots/snapshot-bash-1-aaa.sh" \
  "$home/.claude/paste-cache/old.txt"
run cache cache.snapshots --yes || fail '缓存清理失败'
[[ ! -e "$home/.claude/shell-snapshots/snapshot-bash-1-aaa.sh" ]] || fail '旧快照没删'
[[ -e "$home/.claude/shell-snapshots/snapshot-bash-2-bbb.sh" ]] || fail '新快照被删'
[[ ! -e "$home/.claude/paste-cache/old.txt" ]] || fail '旧粘贴缓存没删'
[[ -e "$home/.claude/paste-cache/new.txt" ]] || fail '新粘贴缓存被删'
ok '旧快照与粘贴缓存按天数清理'

orphan=99999999-aaaa-bbbb-cccc-999999999999
mkdir -p "$home/.claude/file-history/$orphan" "$home/.claude/session-env/$orphan" "$p1/$orphan"
run cache cache.orphans --yes || fail '孤儿清理失败'
[[ ! -e "$home/.claude/file-history/$orphan" ]] || fail '孤儿文件历史没删'
[[ ! -e "$home/.claude/session-env/$orphan" ]] || fail '孤儿会话环境没删'
[[ ! -e "$p1/$orphan" ]] || fail '孤儿的会话目录没删'
[[ -d "$p1/memory" ]] || fail '孤儿清理误伤 memory'
ok '孤儿关联数据清理'

mkdir -p "$home/.claude/plugins/cache/vendor/plugin"
printf 'cache\n' >"$home/.claude/plugins/cache/vendor/plugin/a"
printf '{"installed":1}\n' >"$home/.claude/plugins/installed_plugins.json"
run cache cache.plugins --yes || fail '插件缓存清理失败'
[[ -z $(find "$home/.claude/plugins/cache" -mindepth 1 -print -quit) ]] || fail '插件缓存没清空'
[[ -f "$home/.claude/plugins/installed_plugins.json" ]] || fail '插件清单被误删'
ok '插件缓存只清 cache 子目录'

printf 'history\n' >"$home/.claude/history.jsonl"
printf 'log\n' >"$home/.claude/daemon.log"
run cache cache.history --yes || fail '历史清理失败'
[[ ! -e "$home/.claude/history.jsonl" ]] || fail 'history.jsonl 没删'
[[ -e "$home/.claude/daemon.log" ]] || fail 'daemon.log 被删了'
[[ ! -s "$home/.claude/daemon.log" ]] || fail 'daemon.log 没清空'
ok '历史与守护日志'

kill "$active_pid" 2>/dev/null || true
wait "$active_pid" 2>/dev/null || true
printf '全部通过，测试目录：%s\n' "$tmp"
