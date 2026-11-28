#!/usr/bin/env python3
# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_lsp.py
# @Description: idex 代码索引：LSP 帧、会话、管理器与网页接口。

import io
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE.parent / "src" / "idex" / "web"
FAKE = HERE / "fake_lsp.py"
FAKE_TS = HERE / "fake_tsserver.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(WEB))
from testkit import json_call, load_module, serve

lspmod = load_module("idex_lsp", WEB / "lsp_client.py")
servermod = load_module("idex_server", WEB / "server.py")


class FakeEnv:
    """临时设置假服务器的环境变量，退出时还原。"""

    def __init__(self, **values):
        self.values = values
        self.saved = {}

    def __enter__(self):
        for key, value in self.values.items():
            self.saved[key] = os.environ.get(key)
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = str(value)
        return self

    def __exit__(self, exc_type, exc, tb):
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        return False


def make_root(tmp):
    root = Path(tmp) / "repo"
    (root / "sub").mkdir(parents=True)
    (root / "target.py").write_text("def target():\n    return 1\n", "utf-8")
    (root / "sub" / "other.py").write_text("value = 1\n", "utf-8")
    (root / "note.txt").write_text("hi\n", "utf-8")
    return root


class LspFrames(unittest.TestCase):
    def test_encode_and_read_message(self):
        payload = {"jsonrpc": "2.0", "id": 1, "method": "x", "params": {"a": "中文"}}
        raw = lspmod.encode_message(payload)
        self.assertTrue(raw.startswith(b"Content-Length: "))
        self.assertEqual(lspmod.read_message(io.BytesIO(raw)), payload)

    def test_read_message_ends_with_stream(self):
        self.assertIsNone(lspmod.read_message(io.BytesIO(b"")))
        self.assertIsNone(lspmod.read_message(io.BytesIO(b"Content-Length: 0\r\n\r\n")))

    def test_uri_roundtrip(self):
        path = "/tmp/带空格 的目录/a.py"
        uri = lspmod.path_to_uri(path)
        self.assertTrue(uri.startswith("file://"))
        self.assertEqual(lspmod.uri_to_path(uri), path)
        self.assertIsNone(lspmod.uri_to_path("https://example.com/a.py"))

    def test_normalize_filters_outside_and_dedupes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = make_root(tmp)
            result = [
                {"uri": lspmod.path_to_uri(str(root / "target.py")),
                 "range": {"start": {"line": 3, "character": 2}}},
                {"uri": "file:///etc/passwd", "range": {"start": {"line": 0, "character": 0}}},
                {"targetUri": lspmod.path_to_uri(str(root / "sub" / "other.py")),
                 "targetSelectionRange": {"start": {"line": 1, "character": 4}}},
                {"uri": lspmod.path_to_uri(str(root / "target.py")),
                 "range": {"start": {"line": 3, "character": 2}}},
            ]
            self.assertEqual(
                lspmod.normalize_locations(result, str(root)),
                [
                    {"path": "target.py", "line": 3, "character": 2},
                    {"path": "sub/other.py", "line": 1, "character": 4},
                ],
            )
            self.assertEqual(lspmod.normalize_locations(None, str(root)), [])

    def test_server_and_language_by_suffix(self):
        self.assertEqual(lspmod.server_key("a/b.py"), "python")
        self.assertEqual(lspmod.server_key("a/b.Vue"), "vue")
        self.assertEqual(lspmod.server_key("a/b.txt"), "")
        self.assertEqual(lspmod.language_id("typescript", "a.tsx"), "typescriptreact")
        self.assertEqual(lspmod.language_id("typescript", "a.js"), "javascript")
        self.assertEqual(lspmod.language_id("python", "a.py"), "python")


class LspSession(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-lsp-")
        self.root = make_root(self.tmp.name)
        self.record = Path(self.tmp.name) / "record.jsonl"
        self.env = FakeEnv(
            FAKE_LSP_ROOT=str(self.root),
            FAKE_LSP_RECORD=str(self.record),
            FAKE_LSP_IGNORE=None,
        )
        self.env.__enter__()

    def tearDown(self):
        self.env.__exit__(None, None, None)
        self.tmp.cleanup()

    def start(self, **kwargs):
        return lspmod.LspServer(
            (sys.executable, str(FAKE)), str(self.root), "Fake", **kwargs
        )

    def test_initialize_sync_and_definition(self):
        server = self.start()
        try:
            target = str(self.root / "target.py")
            raw = server.definition(target, "x = 1\n", "python", 0, 0)
            self.assertEqual(len(raw), 3)
            locations = lspmod.normalize_locations(raw, str(self.root))
            self.assertEqual([item["path"] for item in locations], ["target.py", "sub/other.py"])

            lines = [json.loads(line) for line in self.record.read_text("utf-8").splitlines()]
            methods = [item["method"] for item in lines]
            self.assertIn("textDocument/didOpen", methods)
            opened = [item for item in lines if item["method"] == "textDocument/didOpen"][0]
            self.assertEqual(opened["params"]["textDocument"]["text"], "x = 1\n")
            self.assertEqual(opened["params"]["textDocument"]["languageId"], "python")

            server.definition(target, "x = 2\n", "python", 0, 0)
            lines = [json.loads(line) for line in self.record.read_text("utf-8").splitlines()]
            changed = [item for item in lines if item["method"] == "textDocument/didChange"]
            self.assertEqual(changed[0]["params"]["contentChanges"][0]["text"], "x = 2\n")
        finally:
            server.stop()

    def test_initialize_declares_completion_format(self):
        server = self.start()
        try:
            lines = [json.loads(line) for line in self.record.read_text("utf-8").splitlines()]
            init = [item for item in lines if item["method"] == "initialize"][0]
            completion = init["params"]["capabilities"]["textDocument"]["completion"]
            item = completion["completionItem"]
            self.assertFalse(item["snippetSupport"])
            self.assertEqual(item["documentationFormat"], ["markdown", "plaintext"])
        finally:
            server.stop()

    def test_timeout_when_server_stays_silent(self):
        with FakeEnv(FAKE_LSP_IGNORE="definition"):
            server = self.start(init_timeout=3, request_timeout=0.5)
            try:
                with self.assertRaises(lspmod.LspError):
                    server.definition(str(self.root / "target.py"), "x\n", "python", 0, 0)
            finally:
                server.stop()


class TsserverBridgeTests(unittest.TestCase):
    def test_forwards_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            bridge = lspmod.TsserverBridge((sys.executable, str(FAKE_TS)), tmp, "Fake")
            try:
                self.assertEqual(bridge.forward("_vue:echo", ["hi"]), {"echo": ["hi"]})
                with self.assertRaises(lspmod.LspError):
                    bridge.forward("no:such", {})
            finally:
                bridge.stop()


class TsserverResults(unittest.TestCase):
    def test_locations_convert_and_filter(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "repo"
            root.mkdir()
            raw = [{"file": str(root / "a.py"), "start": {"line": 3, "offset": 5}}]
            self.assertEqual(
                lspmod.tsserver_locations(raw, str(root)),
                [{"path": "a.py", "line": 2, "character": 4}],
            )
            outside = [{"file": "/etc/passwd", "start": {"line": 1, "offset": 1}}]
            self.assertEqual(lspmod.tsserver_locations(outside, str(root)), [])
            refs = {"refs": [{"file": str(root / "a.py"), "start": {"line": 2, "offset": 3}}]}
            self.assertEqual(
                lspmod.tsserver_locations(refs, str(root), "references"),
                [{"path": "a.py", "line": 1, "character": 2}],
            )

    def test_rename_plan_converts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = {
                "info": {"canRename": True},
                "locs": [
                    {
                        "file": str(root / "a.py"),
                        "locs": [
                            {
                                "start": {"line": 1, "offset": 1},
                                "end": {"line": 1, "offset": 4},
                            }
                        ],
                    }
                ],
            }
            self.assertEqual(
                lspmod.tsserver_rename_plan(raw, str(root), "x"),
                [
                    {
                        "path": "a.py",
                        "edits": [
                            {
                                "range": {
                                    "start": {"line": 0, "character": 0},
                                    "end": {"line": 0, "character": 3},
                                },
                                "newText": "x",
                            }
                        ],
                    }
                ],
            )
            with self.assertRaises(lspmod.LspError):
                lspmod.tsserver_rename_plan(
                    {"info": {"canRename": False, "localizedErrorMessage": "不行"}, "locs": []},
                    str(root),
                    "x",
                )


class VueBridgeManager(unittest.TestCase):
    """Vue 走语言服务器，它反向问的 tsserver 命令交给桥。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-vue-")
        self.root = Path(self.tmp.name)
        self.vue = self.root / "Comp.vue"
        self.vue.write_text("x\n", "utf-8")
        (self.root / "target.py").write_text("def target():\n    return 1\n", "utf-8")
        (self.root / "sub").mkdir()
        (self.root / "sub" / "other.py").write_text("value = 1\n", "utf-8")
        self.env = FakeEnv(
            FAKE_TS_FILE=str(self.vue),
            FAKE_LSP_ROOT=str(self.root),
            FAKE_LSP_BRIDGE="1",
            FAKE_LSP_DIAGNOSTICS="1",
        )
        self.env.__enter__()

    def tearDown(self):
        self.env.__exit__(None, None, None)
        self.tmp.cleanup()

    def manager(self, bridge=True):
        return lspmod.LspManager(
            commands={
                "vue": (sys.executable, str(FAKE)),
                "typescript": (sys.executable, str(FAKE)),
            },
            rename_warm=0,
            bridge_command=(sys.executable, str(FAKE_TS)) if bridge else (),
        )

    def test_query_rename_and_bridge(self):
        manager = self.manager()
        try:
            data = manager.query("ws", str(self.root), "Comp.vue", "x\n", 0, 0, "definition")
            self.assertEqual(
                [item["path"] for item in data["locations"]],
                ["target.py", "sub/other.py"],
            )
            refs = manager.query("ws", str(self.root), "Comp.vue", "x\n", 0, 0, "references")
            self.assertIn({"path": "target.py", "line": 5, "character": 0}, refs["locations"])
            plan = manager.rename_plan("ws", str(self.root), "Comp.vue", "x\n", 0, 0, "helper")
            self.assertEqual([item["path"] for item in plan["plan"]], ["Comp.vue"])
            self.assertEqual(len(plan["plan"][0]["edits"]), 1)
            outline = manager.symbols("ws", str(self.root), "Comp.vue", "x\n")
            self.assertEqual(
                [(item["name"], item["depth"]) for item in outline["symbols"]],
                [("alpha", 0), ("beta", 1)],
            )
            hover = manager.hover("ws", str(self.root), "Comp.vue", "x\n", 0, 0)
            # 悬停经服务器反向问桥，桥的返回要原样送到服务器。
            self.assertEqual(hover["hover"]["text"], 'bridge:{"echo": ["hi"]}')
            items = manager.diagnostics("ws", str(self.root), "Comp.vue", "x\n")["diagnostics"]
            self.assertEqual(
                [(item["severity"], item["line"], item["message"]) for item in items],
                [("error", 0, "假错误")],
            )
        finally:
            manager.stop_all()

    def test_completion_and_formatting(self):
        manager = self.manager()
        try:
            data = manager.completion("ws", str(self.root), "Comp.vue", "alp\n", 0, 2)
            self.assertEqual([item["label"] for item in data["items"]], ["alpha"])
            formatted = manager.formatting(
                "ws", str(self.root), "Comp.vue", "x\n", {"tabSize": 4, "insertSpaces": True}
            )
            self.assertEqual(formatted["edits"][0]["newText"], "formatted")
            rows = {row["id"]: row for row in manager.status()}
            self.assertTrue(rows["vue"]["available"])
            self.assertTrue(rows["vue"]["capabilities"]["completion"])
            self.assertTrue(rows["vue"]["capabilities"]["formatting"])
        finally:
            manager.stop_all()

    def test_without_bridge_reports_hint(self):
        manager = self.manager(bridge=False)
        try:
            with self.assertRaises(lspmod.LspUnavailable) as caught:
                manager.completion("ws", str(self.root), "Comp.vue", "x\n", 0, 0)
            self.assertIn("@vue/typescript-plugin", str(caught.exception))
        finally:
            manager.stop_all()


class HoverText(unittest.TestCase):
    def test_lsp_hover_shapes(self):
        self.assertEqual(lspmod.lsp_hover_text({"contents": "纯文本"}), "纯文本")
        self.assertEqual(
            lspmod.lsp_hover_text({"contents": {"kind": "markdown", "value": "`x()`"}}),
            "`x()`",
        )
        self.assertEqual(
            lspmod.lsp_hover_text({"contents": [{"language": "ts", "value": "a"}, "b"]}),
            "a\n\nb",
        )
        self.assertEqual(lspmod.lsp_hover_text(None), "")

    def test_tsserver_hover(self):
        self.assertEqual(
            lspmod.tsserver_hover_text({"displayString": "function f()", "documentation": "文档"}),
            "function f()\n\n文档",
        )
        self.assertEqual(lspmod.tsserver_hover_text(None), "")


class SymbolResults(unittest.TestCase):
    def test_lsp_symbols_flatten(self):
        raw = [
            {
                "name": "alpha",
                "kind": 12,
                "selectionRange": {"start": {"line": 0, "character": 4}},
                "children": [
                    {
                        "name": "beta",
                        "kind": 13,
                        "selectionRange": {"start": {"line": 1, "character": 2}},
                    }
                ],
            },
            {
                "name": "gamma",
                "kind": 5,
                "location": {
                    "uri": "file:///x",
                    "range": {"start": {"line": 3, "character": 0}},
                },
            },
        ]
        self.assertEqual(
            lspmod.normalize_symbols(raw),
            [
                {"name": "alpha", "kind": "function", "line": 0, "character": 4, "depth": 0},
                {"name": "beta", "kind": "variable", "line": 1, "character": 2, "depth": 1},
                {"name": "gamma", "kind": "class", "line": 3, "character": 0, "depth": 0},
            ],
        )
        self.assertEqual(lspmod.normalize_symbols(None), [])

    def test_tsserver_symbols_flatten(self):
        raw = {
            "childItems": [
                {
                    "text": "App",
                    "kind": "class",
                    "spans": [{"start": {"line": 2, "offset": 1}}],
                    "childItems": [
                        {
                            "text": "main",
                            "kind": "method",
                            "spans": [{"start": {"line": 3, "offset": 5}}],
                        }
                    ],
                }
            ]
        }
        self.assertEqual(
            lspmod.tsserver_symbols(raw),
            [
                {"name": "App", "kind": "class", "line": 1, "character": 0, "depth": 0},
                {"name": "main", "kind": "method", "line": 2, "character": 4, "depth": 1},
            ],
        )


class RenameEdits(unittest.TestCase):
    def test_position_uses_utf16_units(self):
        text = "名字 = 1\n😀x = 2\n"
        self.assertEqual(lspmod.position_to_index(text, 0, 0), 0)
        self.assertEqual(lspmod.position_to_index(text, 0, 2), 2)
        # emoji 占两个 UTF-16 单元，x 从第 2 列开始。
        self.assertEqual(lspmod.position_to_index(text, 1, 2), text.index("x"))
        with self.assertRaises(ValueError):
            lspmod.position_to_index(text, 5, 0)
        with self.assertRaises(ValueError):
            lspmod.position_to_index(text, 0, 99)

    def test_apply_edits_and_overlap(self):
        text = "abc def"
        edits = [
            {
                "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 3}},
                "newText": "xyz",
            },
            {
                "range": {"start": {"line": 0, "character": 4}, "end": {"line": 0, "character": 7}},
                "newText": "uvw",
            },
        ]
        self.assertEqual(lspmod.apply_text_edits(text, edits), "xyz uvw")
        overlap = [
            {"range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 4}},
             "newText": "a"},
            {"range": {"start": {"line": 0, "character": 2}, "end": {"line": 0, "character": 5}},
             "newText": "b"},
        ]
        with self.assertRaises(ValueError):
            lspmod.apply_text_edits(text, overlap)

    def test_normalize_rejects_outside_and_file_ops(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = make_root(tmp)
            edit = {
                "changes": {
                    "file:///etc/passwd": [
                        {"range": {"start": {"line": 0, "character": 0},
                                   "end": {"line": 0, "character": 1}}, "newText": "x"}
                    ]
                }
            }
            with self.assertRaises(lspmod.LspUnavailable):
                lspmod.normalize_workspace_edit(edit, str(root))
            op = {"documentChanges": [{"kind": "create", "uri": "file://" + str(root / "new.py")}]}
            with self.assertRaises(lspmod.LspUnavailable):
                lspmod.normalize_workspace_edit(op, str(root))


class CompletionResults(unittest.TestCase):
    def test_completions_from_list_and_list_object(self):
        raw = {
            "isIncomplete": True,
            "items": [
                {
                    "label": "alpha",
                    "kind": 3,
                    "detail": "def alpha()",
                    "documentation": {"kind": "markdown", "value": "说明"},
                    "insertText": "alpha()",
                    "sortText": "0",
                    "textEdit": {
                        "range": {
                            "start": {"line": 1, "character": 2},
                            "end": {"line": 1, "character": 5},
                        },
                        "newText": "alpha",
                    },
                }
            ],
        }
        data = lspmod.normalize_completions(raw)
        self.assertTrue(data["incomplete"])
        self.assertEqual(len(data["items"]), 1)
        item = data["items"][0]
        self.assertEqual(item["label"], "alpha")
        self.assertEqual(item["kind"], "function")
        self.assertEqual(item["documentation"], "说明")
        self.assertEqual(item["insertText"], "alpha()")
        self.assertEqual(item["sortText"], "0")
        self.assertEqual(item["textEdit"]["start"], {"line": 1, "character": 2})
        self.assertEqual(item["textEdit"]["end"], {"line": 1, "character": 5})
        self.assertEqual(item["textEdit"]["newText"], "alpha")
        self.assertFalse(lspmod.normalize_completions([{"label": "beta"}])["incomplete"])

    def test_completions_drop_bad_items_and_cap(self):
        items = [{"label": "keep"}, {"label": ""}, {"detail": "no label"}]
        items += [{"label": "x%d" % index} for index in range(300)]
        items.append({"label": "auto", "additionalTextEdits": [{"newText": "import"}]})
        data = lspmod.normalize_completions(items)
        self.assertEqual(data["items"][0]["label"], "keep")
        self.assertEqual(len(data["items"]), 200)
        self.assertNotIn("auto", [item["label"] for item in data["items"]])
        self.assertEqual(lspmod.normalize_completions(None), {"items": [], "incomplete": False})

    def test_format_edits_drop_invalid(self):
        raw = [
            {
                "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 3}},
                "newText": "xyz",
            },
            {
                "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 3}},
            },
            {
                "range": {"start": {"line": -1, "character": 0}, "end": {"line": 0, "character": 3}},
                "newText": "bad",
            },
            {"newText": "no range"},
        ]
        self.assertEqual(
            lspmod.normalize_format_edits(raw),
            [{"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 3}, "newText": "xyz"}],
        )
        self.assertEqual(lspmod.normalize_format_edits(None), [])


class VueSplit(unittest.TestCase):
    def test_block_by_line(self):
        text = (
            "<template>\n"
            "  <div>\n"
            "    <template v-if=\"ok\">x</template>\n"
            "  </div>\n"
            "</template>\n"
            "\n"
            "<script setup>\n"
            "const x = 1\n"
            "</script>\n"
            "<style scoped>\n"
            ".a {}\n"
            "</style>\n"
        )
        self.assertEqual(lspmod.vue_block(text, 0), "template")
        self.assertEqual(lspmod.vue_block(text, 2), "template")
        self.assertEqual(lspmod.vue_block(text, 5), "")
        self.assertEqual(lspmod.vue_block(text, 7), "script")
        self.assertEqual(lspmod.vue_block(text, 10), "style")
        self.assertEqual(lspmod.vue_block(text, 99), "")
        self.assertEqual(lspmod.vue_block("", 0), "")
        nested = (
            "<template>\n"
            "  <template v-if=\"x\">\n"
            "  </template>\n"
            "</template>\n"
            "  <script setup>\n"
            "const x = 1\n"
            "  </script>\n"
        )
        self.assertEqual(lspmod.vue_block(nested, 2), "template")
        self.assertEqual(lspmod.vue_block(nested, 5), "script")

    def test_merge_diagnostics_dedupes_and_sorts(self):
        first = [
            {"line": 2, "character": 0, "severity": "error", "message": "模板"},
            {"line": 1, "character": 3, "severity": "warning", "message": "两边都有"},
        ]
        second = [
            {"line": 1, "character": 3, "severity": "warning", "message": "两边都有"},
            {"line": 0, "character": 1, "severity": "error", "message": "脚本"},
        ]
        self.assertEqual(
            [(item["line"], item["message"]) for item in lspmod.merge_diagnostics(first, second)],
            [(0, "脚本"), (1, "两边都有"), (2, "模板")],
        )

    def test_tsls_bridge_unwraps_body(self):
        calls = []

        class Fake:
            def request(self, method, params, timeout=None):
                calls.append((method, params))
                return {"seq": 0, "type": "response", "success": True, "body": {"ok": True}}

        bridge = lspmod.TsslsBridge(Fake())
        self.assertEqual(bridge.forward("_vue:echo", ["hi"]), {"ok": True})
        method, params = calls[0]
        self.assertEqual(method, "workspace/executeCommand")
        self.assertEqual(params["command"], "typescript.tsserverRequest")
        self.assertEqual(params["arguments"][0], "_vue:echo")


class LspManagers(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-lsp-")
        self.root = make_root(self.tmp.name)
        self.env = FakeEnv(FAKE_LSP_ROOT=str(self.root), FAKE_LSP_RECORD=None, FAKE_LSP_IGNORE=None)
        self.env.__enter__()

    def tearDown(self):
        self.env.__exit__(None, None, None)
        self.tmp.cleanup()

    def test_definition_and_status(self):
        manager = lspmod.LspManager(commands={"python": (sys.executable, str(FAKE))}, rename_warm=0, bridge_command=())
        try:
            data = manager.definition("ws1", str(self.root), "target.py", "x\n", 0, 0)
            self.assertEqual(data["server"], "python")
            self.assertEqual([item["path"] for item in data["locations"]],
                             ["target.py", "sub/other.py"])
            refs = manager.query("ws1", str(self.root), "target.py", "x\n", 0, 0, "references")
            self.assertIn({"path": "target.py", "line": 5, "character": 0}, refs["locations"])
            kind = manager.query("ws1", str(self.root), "target.py", "x\n", 0, 0, "typeDefinition")
            self.assertEqual(len(kind["locations"]), 2)
            hover = manager.hover("ws1", str(self.root), "target.py", "x\n", 0, 0)
            self.assertEqual(hover["hover"]["text"], "`alpha()` 假悬停")
            outline = manager.symbols("ws1", str(self.root), "target.py", "x\n")
            self.assertEqual(
                [(item["name"], item["depth"]) for item in outline["symbols"]],
                [("alpha", 0), ("beta", 1)],
            )
            rows = {row["id"]: row for row in manager.status()}
            self.assertTrue(rows["python"]["available"])
            self.assertTrue(rows["java"]["available"] in (True, False))
            # 测试里把 tsserver 桥关掉了，Vue 就报没装。
            self.assertFalse(rows["vue"]["available"])
            self.assertIn("@vue/typescript-plugin", rows["vue"]["hint"])
            manager.stop_workspace("ws1")
            self.assertEqual(manager.instances, {})
        finally:
            manager.stop_all()

    def test_disabled_server_is_not_started(self):
        class StubSettings:
            def values(self):
                return {"lsp.disabled": ["python"]}

        manager = lspmod.LspManager(
            commands={"python": (sys.executable, str(FAKE))},
            rename_warm=0,
            bridge_command=(),
            settings=StubSettings(),
        )
        try:
            rows = {row["id"]: row for row in manager.status()}
            self.assertFalse(rows["python"]["enabled"])
            self.assertTrue(rows["java"]["enabled"])
            with self.assertRaises(lspmod.LspUnavailable) as caught:
                manager.definition("ws1", str(self.root), "target.py", "x\n", 0, 0)
            self.assertIn("关闭", str(caught.exception))
            self.assertEqual(manager.instances, {})
        finally:
            manager.stop_all()

    def test_rename_preview_and_apply(self):
        manager = lspmod.LspManager(commands={"python": (sys.executable, str(FAKE))}, rename_warm=0, bridge_command=())
        try:
            target = self.root / "target.py"
            text = target.read_text("utf-8")
            preview = manager.rename_plan(
                "ws1", str(self.root), "target.py", text, 0, 0, "renamed"
            )
            self.assertEqual(preview["plan"][0]["path"], "target.py")
            self.assertEqual(target.read_text("utf-8"), text)
            summary = lspmod.apply_workspace_edit(str(self.root), preview["plan"])
            self.assertEqual(summary, [{"path": "target.py", "edits": 1}])
            self.assertTrue(target.read_text("utf-8").startswith("renamed"))
            with self.assertRaises(lspmod.LspUnavailable):
                manager.rename_plan("ws1", str(self.root), "target.py", text, 0, 0, " ")
        finally:
            manager.stop_all()

    def test_diagnostics(self):
        with FakeEnv(FAKE_LSP_DIAGNOSTICS="1"):
            manager = lspmod.LspManager(
                commands={"python": (sys.executable, str(FAKE))},
                rename_warm=0,
                bridge_command=(),
            )
            try:
                items = []
                deadline = time.time() + 5
                while time.time() < deadline:
                    items = manager.diagnostics(
                        "ws1", str(self.root), "target.py", "x\n"
                    )["diagnostics"]
                    if items:
                        break
                    time.sleep(0.2)
                self.assertEqual(items[0]["severity"], "error")
                self.assertEqual(items[0]["message"], "假错误")
                self.assertEqual(items[0]["line"], 0)
            finally:
                manager.stop_all()

    def test_completion_and_formatting(self):
        manager = lspmod.LspManager(commands={"python": (sys.executable, str(FAKE))}, rename_warm=0, bridge_command=())
        try:
            data = manager.completion("ws1", str(self.root), "target.py", "alp\n", 0, 2)
            self.assertEqual(data["server"], "python")
            self.assertEqual([item["label"] for item in data["items"]], ["alpha"])
            self.assertEqual(data["items"][0]["kind"], "function")
            self.assertTrue(data["incomplete"])
            formatted = manager.formatting(
                "ws1", str(self.root), "target.py", "x\n", {"tabSize": 4, "insertSpaces": True}
            )
            self.assertEqual(
                formatted["edits"],
                [{"start": {"line": 0, "character": 0},
                  "end": {"line": 0, "character": 1},
                  "newText": "formatted"}],
            )
            rows = {row["id"]: row for row in manager.status()}
            self.assertTrue(rows["python"]["capabilities"]["completion"])
            self.assertFalse(rows["python"]["capabilities"]["formatting"])
            self.assertTrue(rows["vue"]["capabilities"]["completion"])
            self.assertTrue(rows["vue"]["capabilities"]["formatting"])
        finally:
            manager.stop_all()

    def test_completion_rejects_missing_capability(self):
        with FakeEnv(FAKE_LSP_NO_CAPS="1"):
            manager = lspmod.LspManager(
                commands={"python": (sys.executable, str(FAKE))}, rename_warm=0, bridge_command=()
            )
            try:
                with self.assertRaises(lspmod.LspUnavailable) as caught:
                    manager.completion("ws1", str(self.root), "target.py", "x\n", 0, 0)
                self.assertIn("不支持", str(caught.exception))
                with self.assertRaises(lspmod.LspUnavailable) as caught:
                    manager.formatting(
                        "ws1", str(self.root), "target.py", "x\n", {"tabSize": 4, "insertSpaces": True}
                    )
                self.assertIn("不支持", str(caught.exception))
            finally:
                manager.stop_all()

    def test_completion_syncs_draft_text(self):
        record = Path(self.tmp.name) / "record.jsonl"
        with FakeEnv(FAKE_LSP_RECORD=str(record)):
            manager = lspmod.LspManager(
                commands={"python": (sys.executable, str(FAKE))}, rename_warm=0, bridge_command=()
            )
            try:
                manager.completion("ws1", str(self.root), "target.py", "draft text\n", 0, 2)
            finally:
                manager.stop_all()
        entries = [json.loads(line) for line in record.read_text("utf-8").splitlines() if line]
        syncs = [
            item
            for item in entries
            if item["method"] in ("textDocument/didOpen", "textDocument/didChange")
        ]
        self.assertTrue(syncs)
        params = syncs[-1]["params"]
        text = (params.get("textDocument") or {}).get("text")
        if text is None:
            text = params["contentChanges"][0]["text"]
        self.assertEqual(text, "draft text\n")

    def test_missing_and_unknown_servers(self):
        manager = lspmod.LspManager(commands={"python": ("no-such-lsp-cmd",)}, bridge_command=())
        try:
            with self.assertRaises(lspmod.LspUnavailable) as caught:
                manager.definition("ws1", str(self.root), "target.py", "x\n", 0, 0)
            self.assertIn("没装", str(caught.exception))
            with self.assertRaises(lspmod.LspUnavailable) as caught:
                manager.definition("ws1", str(self.root), "note.txt", "x\n", 0, 0)
            self.assertIn("没有语言服务器", str(caught.exception))
            with self.assertRaises(lspmod.LspUnavailable) as caught:
                manager.definition("ws1", str(self.root), "App.vue", "x\n", 0, 0)
            self.assertIn("Vue 要", str(caught.exception))
            with self.assertRaises(lspmod.LspUnavailable) as caught:
                manager.query("ws1", str(self.root), "target.py", "x\n", 0, 0, "rename")
            self.assertIn("不认识的动作", str(caught.exception))
        finally:
            manager.stop_all()


class LspApi(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-lsp-api-")
        base = Path(self.tmp.name)
        self.root = make_root(base)
        self.static = base / "static"
        self.static.mkdir()
        (self.static / "index.html").write_text("<html></html>", "utf-8")
        self.env = FakeEnv(FAKE_LSP_ROOT=str(self.root), FAKE_LSP_RECORD=None, FAKE_LSP_IGNORE=None)
        self.env.__enter__()
        self.manager = servermod.LspManager(commands={"python": (sys.executable, str(FAKE))}, rename_warm=0, bridge_command=())
        self.server = serve(
            servermod.Handler,
            static=self.static.resolve(),
            api_prefix="/__idex/api",
            store=servermod.Workspaces(str(base / "state.json")),
            settings=servermod.Settings(str(base / "settings.json")),
            lsp=self.manager,
        )
        code, data = json_call(self.server.base, "/workspaces", {"root": str(self.root)})
        self.assertEqual(code, 200, data)
        self.ws = data["workspace"]["id"]

    def tearDown(self):
        self.server.shutdown()
        self.manager.stop_all()
        self.env.__exit__(None, None, None)
        self.tmp.cleanup()

    def call(self, path, body=None):
        return json_call(self.server.base, path, body)

    def test_definition_roundtrip(self):
        code, data = self.call(
            "/lsp/definition",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "line": 0, "character": 0},
        )
        self.assertEqual(code, 200, data)
        self.assertEqual(data["server"], "python")
        self.assertEqual([item["path"] for item in data["locations"]],
                         ["target.py", "sub/other.py"])

        code, data = self.call(
            "/lsp/query",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "line": 0,
             "character": 0, "action": "references"},
        )
        self.assertEqual(code, 200, data)
        self.assertIn({"path": "target.py", "line": 5, "character": 0}, data["locations"])

        code, data = self.call(
            "/lsp/query",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "line": 0,
             "character": 0, "action": "rename"},
        )
        self.assertEqual(code, 400, data)

        code, data = self.call(
            "/lsp/hover",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "line": 0, "character": 0},
        )
        self.assertEqual(code, 200, data)
        self.assertEqual(data["hover"]["text"], "`alpha()` 假悬停")

        code, data = self.call(
            "/lsp/symbols",
            {"ws": self.ws, "path": "target.py", "text": "x\n"},
        )
        self.assertEqual(code, 200, data)
        self.assertEqual([item["name"] for item in data["symbols"]], ["alpha", "beta"])

        code, data = self.call("/lsp/status")
        self.assertEqual(code, 200, data)
        rows = {row["id"]: row for row in data["servers"]}
        self.assertTrue(rows["python"]["available"])

    def test_completion_and_format_roundtrip(self):
        code, data = self.call(
            "/lsp/completion",
            {"ws": self.ws, "path": "target.py", "text": "alp\n", "line": 0, "character": 2},
        )
        self.assertEqual(code, 200, data)
        self.assertEqual(data["server"], "python")
        self.assertEqual([item["label"] for item in data["items"]], ["alpha"])
        self.assertTrue(data["incomplete"])

        code, data = self.call(
            "/lsp/format",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "tabSize": 4, "insertSpaces": True},
        )
        self.assertEqual(code, 200, data)
        self.assertEqual(
            data["edits"],
            [{"start": {"line": 0, "character": 0},
              "end": {"line": 0, "character": 1},
              "newText": "formatted"}],
        )

    def test_completion_and_format_reject_bad_input(self):
        code, data = self.call(
            "/lsp/completion",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "line": -1, "character": 0},
        )
        self.assertEqual(code, 400, data)

        code, data = self.call(
            "/lsp/format",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "tabSize": 0},
        )
        self.assertEqual(code, 400, data)

        code, data = self.call(
            "/lsp/format",
            {"ws": self.ws, "path": "../x.py", "text": "x\n", "tabSize": 4},
        )
        self.assertEqual(code, 400, data)

        code, data = self.call(
            "/lsp/completion",
            {"ws": self.ws, "path": "note.txt", "text": "x\n", "line": 0, "character": 0},
        )
        self.assertEqual(code, 400, data)
        self.assertIn("没有语言服务器", data.get("error", ""))

    def test_completion_reports_missing_capability(self):
        with FakeEnv(FAKE_LSP_NO_CAPS="1"):
            manager = servermod.LspManager(
                commands={"python": (sys.executable, str(FAKE))}, bridge_command=()
            )
            self.server.handler.lsp = manager
            try:
                code, data = self.call(
                    "/lsp/completion",
                    {"ws": self.ws, "path": "target.py", "text": "x\n", "line": 0, "character": 0},
                )
                self.assertEqual(code, 400, data)
                self.assertIn("不支持", data.get("error", ""))
            finally:
                manager.stop_all()

    def test_files_listing_respects_ignore(self):
        ignored = self.root / "node_modules"
        (ignored / "pkg").mkdir(parents=True)
        (ignored / "pkg" / "index.js").write_text("x\n", "utf-8")
        code, data = self.call("/files?ws=" + self.ws)
        self.assertEqual(code, 200, data)
        self.assertIn("target.py", data["files"])
        self.assertNotIn("node_modules/pkg/index.js", data["files"])
        self.assertIn("sub/other.py", data["files"])

    def test_diagnostics(self):
        with FakeEnv(FAKE_LSP_DIAGNOSTICS="1"):
            code, data = 500, {}
            deadline = time.time() + 5
            while time.time() < deadline:
                code, data = self.call(
                    "/lsp/diagnostics",
                    {"ws": self.ws, "path": "target.py", "text": "x\n"},
                )
                if code == 200 and data.get("diagnostics"):
                    break
                time.sleep(0.2)
            self.assertEqual(code, 200, data)
            self.assertEqual(data["diagnostics"][0]["message"], "假错误")

    def test_rename_preview_and_apply(self):
        target = self.root / "target.py"
        before = target.read_text("utf-8")
        body = {
            "ws": self.ws,
            "path": "target.py",
            "text": before,
            "line": 0,
            "character": 0,
            "newName": "renamed",
        }
        code, data = self.call("/lsp/rename", body)
        self.assertEqual(code, 200, data)
        self.assertEqual(data["files"], [{"path": "target.py", "edits": 1}])
        self.assertEqual(target.read_text("utf-8"), before)

        code, data = self.call("/lsp/rename-apply", body)
        self.assertEqual(code, 200, data)
        self.assertTrue(data["applied"])
        self.assertTrue(target.read_text("utf-8").startswith("renamed"))

        body["newName"] = " "
        code, data = self.call("/lsp/rename", body)
        self.assertEqual(code, 400, data)

    def test_rename_rejects_edits_outside(self):
        target = self.root / "target.py"
        body = {
            "ws": self.ws,
            "path": "target.py",
            "text": target.read_text("utf-8"),
            "line": 0,
            "character": 0,
            "newName": "renamed",
        }
        with FakeEnv(FAKE_LSP_ESCAPE="rename"):
            code, data = self.call("/lsp/rename", body)
            self.assertEqual(code, 400, data)
            self.assertIn("工作副本外", data.get("error", ""))

    def test_definition_rejects_bad_input(self):
        code, data = self.call(
            "/lsp/definition",
            {"ws": self.ws, "path": "../x.py", "text": "x\n", "line": 0, "character": 0},
        )
        self.assertEqual(code, 400, data)

        code, data = self.call(
            "/lsp/definition",
            {"ws": self.ws, "path": "target.py", "text": "x\n", "line": "a", "character": 0},
        )
        self.assertEqual(code, 400, data)

        code, data = self.call(
            "/lsp/definition",
            {"ws": self.ws, "path": "note.txt", "text": "x\n", "line": 0, "character": 0},
        )
        self.assertEqual(code, 400, data)
        self.assertIn("没有语言服务器", data.get("error", ""))

    def test_missing_server_reports_hint(self):
        manager = servermod.LspManager(commands={"python": ("no-such-lsp-cmd",)}, bridge_command=())
        self.server.handler.lsp = manager
        try:
            code, data = self.call(
                "/lsp/definition",
                {"ws": self.ws, "path": "target.py", "text": "x\n", "line": 0, "character": 0},
            )
            self.assertEqual(code, 400, data)
            self.assertIn("没装", data.get("error", ""))
        finally:
            manager.stop_all()


if __name__ == "__main__":
    unittest.main(verbosity=2)
