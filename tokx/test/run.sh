#!/usr/bin/env bash
# 在临时 HOME 里造三个来源的假数据，验证采集、去重、峰谷定价与节假日开关。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
bin="$repo/tokx/bin/tokx"
tmp=$(mktemp -d "${TMPDIR:-/tmp}/tokx-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

export HOME="$tmp/home"
mkdir -p "$HOME/.claude/projects/-tmp-demo" "$HOME/.local/share/opencode" "$HOME/.dsh/sessions/-tmp-demo/session-demo"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
ok() { printf 'ok - %s\n' "$*"; }

python3 - "$tmp" <<'PY'
import json, sqlite3, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

home = Path(sys.argv[1]) / "home"
ms = lambda text: int(datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp() * 1000)

# Claude Code：同一条回复按内容块写两行，usage 递增，应只算一次。
lines = [
    {"type": "assistant", "timestamp": "2026-10-26T01:00:00.000Z", "sessionId": "sess-claude",
     "cwd": "/tmp/demo", "message": {"id": "msg-a", "model": "deepseek-flash",
     "usage": {"input_tokens": 1000000, "cache_read_input_tokens": 1000000,
               "cache_creation_input_tokens": 0, "output_tokens": 0}}},
    {"type": "assistant", "timestamp": "2026-10-26T01:00:00.300Z", "sessionId": "sess-claude",
     "cwd": "/tmp/demo", "message": {"id": "msg-a", "model": "deepseek-flash",
     "usage": {"input_tokens": 1000000, "cache_read_input_tokens": 1000000,
               "cache_creation_input_tokens": 0, "output_tokens": 1000000}}},
    {"type": "assistant", "timestamp": "2026-10-26T12:00:00.000Z", "sessionId": "sess-claude",
     "cwd": "/tmp/demo", "message": {"id": "msg-b", "model": "deepseek-flash[1m]",
     "usage": {"input_tokens": 1000000, "cache_read_input_tokens": 0,
               "cache_creation_input_tokens": 0, "output_tokens": 1000000}}},
]
path = home / ".claude/projects/-tmp-demo/sess-claude.jsonl"
path.write_text("\n".join(json.dumps(item) for item in lines) + "\n", encoding="utf-8")

# opencode：免费模型记 0，计费模型按表算，未知模型只计 token。
db = home / ".local/share/opencode/opencode.db"
con = sqlite3.connect(db)
con.execute("create table session (id text primary key, directory text)")
con.execute("create table message (id text primary key, session_id text, time_created integer, data text)")
con.execute("insert into session values ('ses-oc', '/tmp/demo')")
con.execute("insert into session values ('ses-oc2', '/tmp/demo2')")
def message(mid, session, model, tokens, at, provider="opencode"):
    data = {"role": "assistant", "providerID": provider, "modelID": model, "cost": 0,
            "time": {"created": ms(at)}, "tokens": tokens}
    con.execute("insert into message values (?,?,?,?)", (mid, session, ms(at), json.dumps(data)))
message("m1", "ses-oc", "deepseek-v4.1-flash-free",
        {"input": 1000000, "output": 0, "reasoning": 0, "cache": {"read": 0, "write": 0}},
        "2026-10-27T04:00:00Z")
message("m2", "ses-oc2", "deepseek-flash",
        {"input": 500000, "output": 0, "reasoning": 0, "cache": {"read": 0, "write": 0}},
        "2026-10-27T13:00:00Z")
message("m3", "ses-oc2", "mystery-model",
        {"input": 1000, "output": 0, "reasoning": 0, "cache": {"read": 0, "write": 0}},
        "2026-10-27T13:00:00Z")
con.commit()
con.close()

# DeepSeek Harness：zstd 压缩的会话日志。
events = [
    {"type": "session", "version": 4, "id": "session-demo", "createdAt": ms("2026-10-28T04:00:00Z"),
     "cwd": "/tmp/demo", "isSeeded": False, "delegationDepth": 0, "agentPreset": "standard"},
    {"type": "request/header", "seq": 0, "time": ms("2026-10-28T04:00:01Z"),
     "data": {"header": {"config": {"provider": "deepseek-official", "model": "deepseek-flash"}}}},
    {"type": "assistant/message", "seq": 1, "time": ms("2026-10-28T04:00:02Z"),
     "data": {"turn": 1, "step": 1, "usage": {"inputTokens": 1000000, "outputTokens": 0,
              "cacheReadTokens": 0, "cacheWriteTokens": 0, "totalTokens": 1000000}}},
]
raw = ("\n".join(json.dumps(item) for item in events) + "\n").encode("utf-8")
subprocess.run(["zstd", "-q", "-f", "-o", str(home / ".dsh/sessions/-tmp-demo/session-demo/session.v4.jsonl.zstd")],
               input=raw, check=True)
PY

[[ -x "$bin" ]] || fail "找不到可执行的 $bin"

output=$("$bin" --all --json) || fail "tokx 退出码非 0"
python3 - "$output" <<'PY' || exit 1
import json, sys
payload = json.loads(sys.argv[1])
rows = payload["rows"]
by_source = {row["source"]: row for row in rows}
claude = by_source["claude"]
assert claude["requests"] == 2, claude
assert abs(claude["cost_peak"] - 10.04) < 1e-6, claude
assert abs(claude["cost_off"] - 5.0) < 1e-6, claude
assert claude["total_tokens"] == 5_000_000, claude

opencode = by_source["opencode"]
assert opencode["requests"] == 3, opencode
assert abs(opencode["cost_off"] - 0.5) < 1e-6, opencode
assert opencode["unpriced"] == 1, opencode

dsh = by_source["dsh"]
assert abs(dsh["cost_off"] - 1.0) < 1e-6, dsh
assert abs(payload["totals"]["cost"] - 16.54) < 1e-6, payload["totals"]
assert payload["totals"]["total_tokens"] == 7_501_000, payload["totals"]
print("ok - 三个来源的峰谷费用")
PY

# 节假日把工作日高峰整段降为空闲价。
cat >"$tmp/holiday.toml" <<'EOF'
[peak]
holidays = ["2026-10-26"]
EOF
output=$("$bin" --all --json --config "$tmp/holiday.toml") || fail "带配置运行失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
payload = json.loads(sys.argv[1])
claude = {row["source"]: row for row in payload["rows"]}["claude"]
assert claude["cost_peak"] == 0, claude
assert abs(claude["cost_off"] - 10.02) < 1e-6, claude
print("ok - 节假日全天按空闲价")
PY

# 未知模型要有提示，且不能吞掉其他来源。
err=$("$bin" --all --json 2>&1 >/dev/null) || fail "运行失败"
[[ "$err" == *"mystery-model"* ]] || fail "未知模型没有提示: $err"
ok 未知模型有提示

# 来源过滤与日期过滤。
output=$("$bin" --all --json -s claude) || fail "来源过滤失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
rows = json.loads(sys.argv[1])["rows"]
assert {row["source"] for row in rows} == {"claude"}, rows
print("ok - 来源过滤")
PY

output=$("$bin" --json --since 2026-10-28 --until 2026-10-28) || fail "日期过滤失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
payload = json.loads(sys.argv[1])
assert [row["date"] for row in payload["rows"]] == ["2026-10-28"], payload["rows"]
print("ok - 日期过滤")
PY

# 价格表 JSON。
output=$("$bin" prices --json) || fail "prices 失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
models = json.loads(sys.argv[1])["models"]
flash = models["deepseek-flash"]
assert flash["off"]["hit"] == 0.02 and flash["peak"]["miss"] == 2.0, flash
print("ok - 价格表")
PY

# 会话表要带来源；顺带验证中文宽度对齐不报错。
session_out=$("$bin" session --all) || fail "session 命令失败"
[[ "$session_out" == *"claude"* ]] || fail "会话表缺少来源列"
ok 会话表带来源
"$bin" hour --all >/dev/null || fail "hour 命令失败"
ok session 与 hour 命令

# 菜单在非终端下退回编号输入：全历史、只勾 claude 与 dsh，然后退出。
printf '1\n5\n1 3\n5\n' | "$bin" menu >"$tmp/menu.out" 2>"$tmp/menu.err" || fail "菜单退出码非 0"
grep -q '^claude' "$tmp/menu.out" || fail "菜单输出缺少 claude"
grep -q '^dsh' "$tmp/menu.out" || fail "菜单输出缺少 dsh"
grep -q '^opencode' "$tmp/menu.out" && fail "菜单没有排除 opencode"
ok 菜单按来源过滤

# 主菜单回车取消，退出码是 3。
printf '' | "$bin" menu >/dev/null 2>&1
[[ $? -eq 3 ]] || fail "取消菜单的退出码不是 3"
ok 取消菜单返回 3

printf '\n全部通过\n'
