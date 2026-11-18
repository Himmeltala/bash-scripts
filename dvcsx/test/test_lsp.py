#!/usr/bin/env python3
"""dvcsx 代码索引：LSP 帧、会话、管理器与网页接口。"""

import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE.parent / "lib" / "dvcsx" / "web"
FAKE = HERE / "fake_lsp.py"
FAKE_TS = HERE / "fake_tsserver.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(WEB))
from testkit import json_call, load_module, serve

lspmod = load_module("dvcsx_lsp", WEB / "lsp_client.py")
servermod = load_module("dvcsx_server", WEB / "server.py")


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
        self.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-lsp-")
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
    """Vue 走 tsserver 桥：查询与重命名都换成相对路径。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-vue-")
        self.root = Path(self.tmp.name)
        self.vue = self.root / "Comp.vue"
        self.vue.write_text("x\n", "utf-8")
        self.env = FakeEnv(FAKE_TS_FILE=str(self.vue))
        self.env.__enter__()

    def tearDown(self):
        self.env.__exit__(None, None, None)
        self.tmp.cleanup()

    def test_query_and_rename(self):
        manager = lspmod.LspManager(bridge_command=(sys.executable, str(FAKE_TS)))
        try:
            data = manager.query("ws", str(self.root), "Comp.vue", "x\n", 0, 0, "definition")
            self.assertEqual(
                data["locations"], [{"path": "Comp.vue", "line": 1, "character": 2}]
            )
            refs = manager.query("ws", str(self.root), "Comp.vue", "x\n", 0, 0, "references")
            self.assertEqual([item["line"] for item in refs["locations"]], [1, 4])
            plan = manager.rename_plan("ws", str(self.root), "Comp.vue", "x\n", 0, 0, "helper")
            self.assertEqual([item["path"] for item in plan["plan"]], ["Comp.vue"])
            self.assertEqual(len(plan["plan"][0]["edits"]), 1)
            outline = manager.symbols("ws", str(self.root), "Comp.vue", "x\n")
            self.assertEqual(
                [(item["name"], item["depth"]) for item in outline["symbols"]],
                [("App", 0), ("main", 1)],
            )
        finally:
            manager.stop_all()


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


class LspManagers(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-lsp-")
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
        self.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-lsp-api-")
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
            api_prefix="/__dvcsx/api",
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
            "/lsp/symbols",
            {"ws": self.ws, "path": "target.py", "text": "x\n"},
        )
        self.assertEqual(code, 200, data)
        self.assertEqual([item["name"] for item in data["symbols"]], ["alpha", "beta"])

        code, data = self.call("/lsp/status")
        self.assertEqual(code, 200, data)
        rows = {row["id"]: row for row in data["servers"]}
        self.assertTrue(rows["python"]["available"])

    def test_files_listing_respects_ignore(self):
        ignored = self.root / "node_modules"
        (ignored / "pkg").mkdir(parents=True)
        (ignored / "pkg" / "index.js").write_text("x\n", "utf-8")
        code, data = self.call("/files?ws=" + self.ws)
        self.assertEqual(code, 200, data)
        self.assertIn("target.py", data["files"])
        self.assertNotIn("node_modules/pkg/index.js", data["files"])
        self.assertIn("sub/other.py", data["files"])

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
