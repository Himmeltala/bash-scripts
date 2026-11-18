#!/usr/bin/env python3
"""测试用假语言服务器：按 LSP 帧回话，定义结果是固定的几条，供桥接层断言。

环境变量：
- FAKE_LSP_ROOT：定义结果的根目录，默认当前目录。
- FAKE_LSP_IGNORE：设成 definition 就不回定义，用来测超时。
- FAKE_LSP_RECORD：把收到的通知逐行记进这个文件，用来断言文档同步。
"""

import json
import os
import sys


def read_message(stream):
    headers = {}
    while True:
        line = stream.readline()
        if not line:
            return None
        text = line.decode("ascii", "replace").strip()
        if not text:
            break
        name, _, value = text.partition(":")
        headers[name.strip().lower()] = value.strip()
    try:
        length = int(headers.get("content-length") or 0)
    except ValueError:
        return None
    body = stream.read(length)
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None


def send(payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(b"Content-Length: %d\r\n\r\n" % len(body) + body)
    sys.stdout.buffer.flush()


ROOT = os.environ.get("FAKE_LSP_ROOT") or os.getcwd()
IGNORE = os.environ.get("FAKE_LSP_IGNORE") or ""
RECORD = os.environ.get("FAKE_LSP_RECORD") or ""


def record(event):
    if not RECORD:
        return
    with open(RECORD, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=False) + "\n")


def locations():
    return [
        {
            "uri": "file://" + ROOT + "/target.py",
            "range": {"start": {"line": 3, "character": 2}},
        },
        {
            "uri": "file:///etc/passwd",
            "range": {"start": {"line": 0, "character": 0}},
        },
        {
            "targetUri": "file://" + ROOT + "/sub/other.py",
            "targetSelectionRange": {"start": {"line": 1, "character": 4}},
        },
    ]


def main():
    while True:
        message = read_message(sys.stdin.buffer)
        if message is None:
            return 0
        method = message.get("method")
        if "id" in message and method:
            if method == "initialize":
                send(
                    {
                        "jsonrpc": "2.0",
                        "id": message["id"],
                        "result": {"capabilities": {"definitionProvider": True}},
                    }
                )
            elif method == "shutdown":
                send({"jsonrpc": "2.0", "id": message["id"], "result": None})
            elif method == "textDocument/documentSymbol":
                send(
                    {
                        "jsonrpc": "2.0",
                        "id": message["id"],
                        "result": [
                            {
                                "name": "alpha",
                                "kind": 12,
                                "range": {"start": {"line": 0, "character": 0}},
                                "selectionRange": {"start": {"line": 0, "character": 4}},
                                "children": [
                                    {
                                        "name": "beta",
                                        "kind": 13,
                                        "range": {"start": {"line": 1, "character": 2}},
                                        "selectionRange": {"start": {"line": 1, "character": 2}},
                                    }
                                ],
                            }
                        ],
                    }
                )
            elif method == "textDocument/definition":
                if IGNORE == "definition":
                    continue
                send({"jsonrpc": "2.0", "id": message["id"], "result": locations()})
            elif method == "textDocument/rename":
                params = message.get("params") or {}
                uri = (params.get("textDocument") or {}).get("uri", "")
                name = params.get("newName", "renamed")
                edit = {
                    "range": {
                        "start": {"line": 0, "character": 0},
                        "end": {"line": 0, "character": 3},
                    },
                    "newText": name,
                }
                if os.environ.get("FAKE_LSP_ESCAPE") == "rename":
                    changes = {"file:///etc/passwd": [edit]}
                else:
                    changes = {uri: [edit]}
                send({"jsonrpc": "2.0", "id": message["id"], "result": {"changes": changes}})
            elif method in (
                "textDocument/typeDefinition",
                "textDocument/implementation",
                "textDocument/references",
            ):
                found = locations()
                if method == "textDocument/references":
                    # 引用额外给一条，测试据此确认请求真的走的是 references。
                    found = found + [
                        {
                            "uri": "file://" + ROOT + "/target.py",
                            "range": {"start": {"line": 5, "character": 0}},
                        }
                    ]
                send({"jsonrpc": "2.0", "id": message["id"], "result": found})
            else:
                send({"jsonrpc": "2.0", "id": message["id"], "result": None})
            continue
        if method:
            record({"method": method, "params": message.get("params")})
            if method == "textDocument/didOpen" and os.environ.get("FAKE_LSP_DIAGNOSTICS") == "1":
                uri = ((message.get("params") or {}).get("textDocument") or {}).get("uri", "")
                send(
                    {
                        "jsonrpc": "2.0",
                        "method": "textDocument/publishDiagnostics",
                        "params": {
                            "uri": uri,
                            "diagnostics": [
                                {
                                    "range": {
                                        "start": {"line": 0, "character": 0},
                                        "end": {"line": 0, "character": 3},
                                    },
                                    "severity": 1,
                                    "message": "假错误",
                                    "source": "fake",
                                }
                            ],
                        },
                    }
                )
            if method == "exit":
                return 0


if __name__ == "__main__":
    sys.exit(main())
