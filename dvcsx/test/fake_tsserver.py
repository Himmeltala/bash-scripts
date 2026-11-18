#!/usr/bin/env python3
"""测试用假 tsserver：收一行一条 JSON，回 Content-Length 帧。

认 configure、open、exit，几种语言查询，以及 _vue:echo。
定义、引用、重命名的形状照 tsserver 的返回给，文件路径由 FAKE_TS_FILE 指定。
"""

import json
import os
import sys


def read_line():
    line = sys.stdin.buffer.readline()
    if not line.strip():
        return None
    try:
        return json.loads(line.decode("utf-8"))
    except ValueError:
        return None


def send(payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(b"Content-Length: %d\r\n\r\n" % len(body) + body)
    sys.stdout.buffer.flush()


def reply(message, success=True, body=None, error=""):
    payload = {
        "seq": 0,
        "type": "response",
        "command": message.get("command", ""),
        "request_seq": message.get("seq", 0),
        "success": success,
    }
    if success:
        payload["body"] = body
    else:
        payload["message"] = error
    send(payload)


FILE = os.environ.get("FAKE_TS_FILE") or ""


def main():
    while True:
        message = read_line()
        if message is None:
            return 0
        command = message.get("command")
        if command == "exit":
            return 0
        if command in ("configure", "open"):
            reply(message, body=None)
        elif command == "_vue:echo":
            reply(message, body={"echo": message.get("arguments")})
        elif command in ("definition", "typeDefinition", "implementation"):
            reply(message, body=[{"file": FILE, "start": {"line": 2, "offset": 3}}])
        elif command == "references":
            reply(
                message,
                body={
                    "refs": [
                        {"file": FILE, "start": {"line": 2, "offset": 3}},
                        {"file": FILE, "start": {"line": 5, "offset": 7}},
                    ]
                },
            )
        elif command == "rename":
            reply(
                message,
                body={
                    "info": {"canRename": True},
                    "locs": [
                        {
                            "file": FILE,
                            "locs": [
                                {
                                    "start": {"line": 1, "offset": 1},
                                    "end": {"line": 1, "offset": 4},
                                }
                            ],
                        }
                    ],
                },
            )
        else:
            reply(message, success=False, error="不认识的命令：%s" % command)


if __name__ == "__main__":
    sys.exit(main())
