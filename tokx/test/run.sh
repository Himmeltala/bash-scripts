#!/usr/bin/env bash
# 在临时 HOME 里造三个来源的假数据，验证采集、去重、峰谷定价与节假日开关。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
bin="$repo/tokx/bin/tokx"
tmp=$(mktemp -d "${TMPDIR:-/tmp}/tokx-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

export HOME="$tmp/home"
mkdir -p "$HOME/.claude/projects/-tmp-demo" "$HOME/.local/share/opencode" "$HOME/.dsh/sessions/-tmp-demo/session-demo"
mkdir -p "$HOME/.config/opencode" "$HOME/.dsh/profiles/web"

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

# Claude Code 的接口地址取设置文件里的 ANTHROPIC_BASE_URL。
(home / ".claude/settings.json").write_text(
    json.dumps({"env": {"ANTHROPIC_BASE_URL": "http://127.0.0.1:9000"}}), encoding="utf-8"
)

# opencode 的接口地址取 provider 的 options.baseURL。
(home / ".config/opencode/opencode.json").write_text(
    json.dumps({"provider": {"opencode": {"options": {"baseURL": "https://opencode.test/v1"}}}}),
    encoding="utf-8",
)

# DeepSeek Harness 的接口地址取 profile 补丁里的 providers.<id>.baseURL。
(home / ".dsh/profiles/web/cordis.patch.yml").write_text(
    "\n".join(
        [
            "- id: llm-pi-ai",
            "  name: \"@deepseek-ai/dsh-llm-pi-ai\"",
            "  config:",
            "    providers:",
            "      deepseek-official:",
            "        baseURL: \"http://127.0.0.1:9001/v1\"",
            "        models:",
            "          - id: deepseek-flash",
            "",
        ]
    ),
    encoding="utf-8",
)

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
# 日报按来源、模型分行：同一来源的不同模型各算各的费用。
by_model = {(row["source"], row["model"]): row for row in rows}
claude = by_model[("claude", "deepseek-flash")]
assert claude["requests"] == 2, claude
assert abs(claude["cost_peak"] - 10.04) < 1e-6, claude
assert abs(claude["cost_off"] - 5.0) < 1e-6, claude
assert claude["total_tokens"] == 5_000_000, claude
assert claude["api"] == "http://127.0.0.1:9000", claude

free = by_model[("opencode", "deepseek-v4.1-flash-free")]
assert free["cost"] == 0.0, free

oc_flash = by_model[("opencode", "deepseek-flash")]
assert abs(oc_flash["cost_off"] - 0.5) < 1e-6, oc_flash
assert oc_flash["api"] == "https://opencode.test/v1", oc_flash

# 无价模型单独一行，只有自己留空，不会把同来源的有价模型一起拖成 --。
oc_unknown = by_model[("opencode", "mystery-model")]
assert oc_unknown["cost"] is None and oc_unknown["unpriced"] == 1, oc_unknown

dsh = by_model[("dsh", "deepseek-flash")]
assert abs(dsh["cost_off"] - 1.0) < 1e-6, dsh
assert dsh["api"] == "http://127.0.0.1:9001/v1", dsh
# 合计只累加计得出来的行：claude 15.04 + opencode 0.5 + dsh 1.0。
assert abs(payload["totals"]["cost"] - 16.54) < 1e-6, payload["totals"]
assert payload["totals"]["total_tokens"] == 7_501_000, payload["totals"]
assert payload["unpriced_models"] == ["mystery-model"], payload["unpriced_models"]
print("ok - 按模型分行的峰谷费用")
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
claude = next(row for row in payload["rows"] if row["source"] == "claude")
assert claude["cost_peak"] == 0, claude
assert abs(claude["cost_off"] - 10.02) < 1e-6, claude
print("ok - 节假日全天按空闲价")
PY

# 无价模型照样出表：它自己那行费用显示 --，同一行的有价模型照常给出金额。
table=$("$bin" --all) || fail "运行失败"
python3 - "$table" <<'PY' || exit 1
import sys
lines = sys.argv[1].splitlines()
row = next(line for line in lines if line.startswith("opencode") and "mystery-model" in line)
assert "--" in row and "¥" not in row, row
priced = next(line for line in lines if line.startswith("opencode") and "deepseek-flash" in line)
assert "¥" in priced, priced
# 表头带接口地址列，地址按各自配置解析。
assert "API 地址" in " ".join(lines[0].split()), lines[0]
assert any(line.startswith("claude") and "http://127.0.0.1:9000" in line for line in lines), lines
assert any(line.startswith("未计价模型") and "mystery-model" in line for line in lines), lines
print("ok - 无价模型单独一行，费用显示 --")
PY
err=$("$bin" --all 2>&1 >/dev/null) || fail "运行失败"
[[ -z "$err" ]] || fail "不该再往 stderr 写提示: $err"
ok 没有多余的 stderr 提示

# tokx 配置里的 [apis] 优先于日志与各工具配置。
cat >"$tmp/apis.toml" <<'EOF'
[apis]
"deepseek-official" = "http://relay.local/v1"
EOF
output=$("$bin" --all --json --config "$tmp/apis.toml") || fail "带 [apis] 配置运行失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
rows = json.loads(sys.argv[1])["rows"]
dsh = next(row for row in rows if row["source"] == "dsh")
assert dsh["api"] == "http://relay.local/v1", dsh
print("ok - tokx 配置覆盖接口地址")
PY

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

# 同一会话用过两个模型时，会话表按模型分成两行。
session_json=$("$bin" session --all --json) || fail "session --json 失败"
python3 - "$session_json" <<'PY' || exit 1
import json, sys
rows = json.loads(sys.argv[1])["rows"]
sess = [row for row in rows if row["session"] == "ses-oc2"]
assert {row["model"] for row in sess} == {"deepseek-flash", "mystery-model"}, sess
print("ok - 同一会话按模型分行")
PY

# 账本：删掉 Claude 的会话文件后，那部分用量还能从账本回显，并标成缓存。
[[ -f "$HOME/.local/state/tokx/usage.db" ]] || fail "首次运行没建账本"
rm -f "$HOME/.claude/projects/-tmp-demo/sess-claude.jsonl"
rm -f "$HOME/.local/state/tokx/cache/claude.json"
output=$("$bin" --all --json) || fail "删掉会话后运行失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
payload = json.loads(sys.argv[1])
cache = [row for row in payload["rows"] if row["origin"] == "cache"]
assert [row["source"] for row in cache] == ["claude"], cache
assert cache[0]["date"] == "2026-10-26" and cache[0]["model"] == "deepseek-flash", cache[0]
assert cache[0]["requests"] == 2, cache[0]
# 回显的数字与删除前一致，合计不变。
assert abs(payload["totals"]["cost"] - 16.54) < 1e-6, payload["totals"]
assert payload["totals"]["total_tokens"] == 7_501_000, payload["totals"]
print("ok - 被删会话从账本回显")
PY

table=$("$bin" --all) || fail "回显后出表失败"
python3 - "$table" <<'PY' || exit 1
import sys
lines = sys.argv[1].splitlines()
row = next(line for line in lines if line.startswith("claude"))
assert "缓存" in row, row
assert any("出处标为缓存" in line for line in lines), lines[-3:]
print("ok - 表里标出缓存来源")
PY

# 同一份数据再跑两遍，账本不会重复累加。
first=$("$bin" --all --json) || fail "第二次运行失败"
second=$("$bin" --all --json) || fail "第三次运行失败"
[[ "$first" == "$second" ]] || fail "多次运行数字不一致"
ok 重复运行数字稳定

# tokx db status 能看到账本内容，db import 重复导入不翻倍。
status=$("$bin" db status) || fail "db status 失败"
[[ "$status" == *"请求"* ]] || fail "db status 输出不对: $status"
ok db status

before=$("$bin" --all --json) || fail "导入前运行失败"
import_out=$("$bin" db import --json) || fail "db import 失败"
after=$("$bin" --all --json) || fail "导入后运行失败"
[[ "$before" == "$after" ]] || fail "db import 后数字变了"
python3 - "$import_out" <<'PY' || exit 1
import json, sys
payload = json.loads(sys.argv[1])
assert payload["records"] >= payload["added"] >= 0, payload
print("ok - db import 不重复计入")
PY

# 会话文件变短（被重写）时以现扫为准，不把消失的请求留在账本里。
python3 - "$HOME" <<'PY' || exit 1
import json, sys
from pathlib import Path
home = Path(sys.argv[1])
path = home / ".claude/projects/-tmp-demo/sess-claude.jsonl"
lines = [
    {"type": "assistant", "timestamp": "2026-10-26T01:00:00.000Z", "sessionId": "sess-claude",
     "cwd": "/tmp/demo", "message": {"id": "msg-a", "model": "deepseek-flash",
     "usage": {"input_tokens": 1000000, "cache_read_input_tokens": 1000000,
               "cache_creation_input_tokens": 0, "output_tokens": 1000000}}},
]
path.write_text("\n".join(json.dumps(item) for item in lines) + "\n", encoding="utf-8")
PY
output=$("$bin" --all --json) || fail "会话变短后运行失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
payload = json.loads(sys.argv[1])
claude = [row for row in payload["rows"] if row["source"] == "claude"]
assert len(claude) == 1 and claude[0]["requests"] == 1, claude
assert claude[0]["origin"] == "live", claude
print("ok - 会话变短后以现扫为准")
PY

# 账本按天清理：老会话里的请求时间没动，按请求时间算就不会被一次次刷新而永远清不掉。
PYTHONPATH="$repo/tokx/lib" python3 - "$HOME" <<'PY' || exit 1
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from tokx.model import Record, Usage
from tokx.store import Store

path = Path(sys.argv[1]) / ".local/state/tokx/usage.db"
old = datetime(2020, 1, 1, tzinfo=timezone.utc)
record = Record(source="claude", session="sess-old", at=old, model="deepseek-flash",
                usage=Usage(input=1), key="old-1")
with Store(path, ZoneInfo("Asia/Shanghai")) as store:
    store.insert({"claude": {"sess-old": [record]}})
    assert store.stale(["claude"], 30) == [("claude", "sess-old")]
    store.forget(store.stale(["claude"], 30))
    assert store.stale(["claude"], 30) == []
print("ok - db gc 按请求时间清理")
PY

# mimo 只有实时推理价，不分峰谷：两档同价，金额按 miss 价算。
output=$("$bin" prices --json) || fail "prices 失败"
python3 - "$output" <<'PY' || exit 1
import json, sys
models = json.loads(sys.argv[1])["models"]
flash = models["mimo-v2.6-flash"]
assert flash["off"] == flash["peak"] == {"hit": 0.02, "miss": 1.0, "output": 2.0}, flash
assert models["mimo-v2.6-pro"]["peak"]["miss"] == 3.0, models["mimo-v2.6-pro"]
assert models["mimo-v2.6-pro-ultraspeed"]["off"]["output"] == 60.0
print("ok - mimo 实时价")
PY

# opencode 的配置文件允许注释，剥注释后再解析。
PYTHONPATH="$repo/tokx/lib" python3 - <<'PY' || exit 1
import json
from tokx.api import _strip_jsonc

text = '{\n // 行注释\n "a": "// 不是注释", /* 块注释 */\n "b": 1\n}'
assert json.loads(_strip_jsonc(text)) == {"a": "// 不是注释", "b": 1}
print("ok - 剥离 JSONC 注释")
PY

# 直连计价函数：高峰与空闲时段金额相同，输入按 miss 价。
PYTHONPATH="$repo/tokx/lib" python3 - <<'PY' || exit 1
from datetime import datetime, timezone
from tokx.model import Usage
from tokx.pricing import PriceBook

book = PriceBook()
usage = Usage(input=1_000_000)
peak = datetime(2026, 11, 5, 3, 0, tzinfo=timezone.utc)   # 北京 11:00，高峰
off = datetime(2026, 11, 5, 13, 0, tzinfo=timezone.utc)    # 北京 21:00，空闲
assert abs(book.cost("mimo-v2.6-flash", usage, peak) - 1.0) < 1e-9
assert book.cost("mimo-v2.6-flash", usage, off) == book.cost("mimo-v2.6-flash", usage, peak)
assert abs(book.cost("mimo-v2.6-pro", usage, peak) - 3.0) < 1e-9
assert abs(book.cost("mimo-v2.6-pro-ultraspeed", usage, peak) - 30.0) < 1e-9
print("ok - mimo 不分峰谷")
PY

# 菜单在非终端下退回编号输入：全历史、只勾 claude 与 dsh，然后退出。
printf '1\n5\n1 3\n6\n' | "$bin" menu >"$tmp/menu.out" 2>"$tmp/menu.err" || fail "菜单退出码非 0"
grep -q '^claude' "$tmp/menu.out" || fail "菜单输出缺少 claude"
grep -q '^dsh' "$tmp/menu.out" || fail "菜单输出缺少 dsh"
grep -q '^opencode' "$tmp/menu.out" && fail "菜单没有排除 opencode"
ok 菜单按来源过滤

# 主菜单回车取消，退出码是 3。
printf '' | "$bin" menu >/dev/null 2>&1
[[ $? -eq 3 ]] || fail "取消菜单的退出码不是 3"
ok 取消菜单返回 3

if grep -q 'ui_pause' "$repo/tokx/lib/tokx-tui.sh" &&
  ! grep -q 'IFS= read -r key' "$repo/tokx/lib/tokx-tui.sh"; then
  ok 'tokx 用 bash-tui 的暂停'
else
  fail 'tokx 仍自行处理按键'
fi

printf '\n全部通过\n'
