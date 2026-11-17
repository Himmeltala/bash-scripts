"""把发送方向的内容解析成可展示的关键字段。

只认特征明确的几种：HTTP/1.x 请求、TLS ClientHello、DNS 查询；认不出就给文本或十六进制预览。
返回的字典键固定，认不出的字段给空值，调用方不用判空。
"""

import struct

HTTP_METHODS = {
    b"GET",
    b"POST",
    b"PUT",
    b"DELETE",
    b"HEAD",
    b"OPTIONS",
    b"PATCH",
    b"CONNECT",
    b"TRACE",
    b"PRI",
}

DNS_TYPES = {
    1: "A",
    2: "NS",
    5: "CNAME",
    6: "SOA",
    12: "PTR",
    15: "MX",
    16: "TXT",
    28: "AAAA",
    33: "SRV",
    65: "HTTPS",
}

MAX_PREVIEW = 4096
MAX_BINARY = 2048


def _blank(**fields):
    parsed = {
        "kind": "",
        "host": "",
        "url": "",
        "sni": "",
        "dns_name": "",
        "dns_type": "",
        "method": "",
        "path": "",
        "headers": [],
        "body": "",
        "body_encoding": "",
        "headers_complete": False,
        "alpn": [],
        "preview": "",
        "preview_encoding": "",
    }
    parsed.update(fields)
    return parsed


def _text_of(data):
    """能按 UTF-8 解出且绝大多数是可打印字符时返回文本，否则返回 None。"""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not text:
        return ""
    printable = sum(1 for char in text if char >= " " or char in "\r\n\t")
    return text if printable / len(text) >= 0.9 else None


def _body_of(data):
    text = _text_of(data)
    if text is not None:
        return text[:MAX_PREVIEW], "text"
    return data[:MAX_BINARY].hex(), "hex"


def _parse_http(data):
    line_end = data.find(b"\r\n")
    if line_end <= 0:
        return None
    parts = data[:line_end].decode("latin-1", "replace").split(" ")
    if len(parts) < 3:
        return None
    method, target, version = parts[0], parts[1], parts[2]
    if method.encode("latin-1") not in HTTP_METHODS or not version.startswith("HTTP/"):
        return None

    head, sep, body = data.partition(b"\r\n\r\n")
    headers = []
    for line in head.split(b"\r\n")[1:]:
        name, colon, value = line.partition(b":")
        if not colon:
            continue
        headers.append([name.decode("latin-1").strip(), value.decode("latin-1").strip()])

    host = ""
    for name, value in headers:
        if name.lower() == "host":
            host = value
            break

    if target.startswith("http://") or target.startswith("https://"):
        url = target
    elif target.startswith("/") and host:
        url = "http://" + host + target
    else:
        url = target

    body_text, body_encoding = _body_of(body if sep else b"")
    return _blank(
        kind="http",
        host=host,
        url=url,
        method=method,
        path=target,
        headers=headers,
        body=body_text,
        body_encoding=body_encoding,
        headers_complete=bool(sep),
    )


def _parse_sni(data):
    if len(data) < 2:
        return ""
    end = min(len(data), 2 + struct.unpack("!H", data[:2])[0])
    pos = 2
    while pos + 3 <= end:
        kind = data[pos]
        length = struct.unpack("!H", data[pos + 1 : pos + 3])[0]
        name = data[pos + 3 : pos + 3 + length]
        pos += 3 + length
        if kind == 0:
            return name.decode("ascii", "replace")
    return ""


def _parse_alpn(data):
    if len(data) < 2:
        return []
    end = min(len(data), 2 + struct.unpack("!H", data[:2])[0])
    pos = 2
    out = []
    while pos < end:
        length = data[pos]
        pos += 1
        out.append(data[pos : pos + length].decode("latin-1", "replace"))
        pos += length
    return out


def _parse_tls(data):
    if len(data) < 5 or data[0] != 0x16 or data[1] != 0x03:
        return None
    record_len = struct.unpack("!H", data[3:5])[0]
    handshake = data[5 : 5 + record_len]
    if len(handshake) < 4 or handshake[0] != 1:
        return _blank(kind="tls")

    body = handshake[4:]
    pos = 2 + 32
    if len(body) < pos:
        return _blank(kind="tls")
    pos += 1 + body[pos]
    if pos + 2 > len(body):
        return _blank(kind="tls")
    pos += 2 + struct.unpack("!H", body[pos : pos + 2])[0]
    if pos >= len(body):
        return _blank(kind="tls")
    pos += 1 + body[pos]
    if pos + 2 > len(body):
        return _blank(kind="tls")
    total = struct.unpack("!H", body[pos : pos + 2])[0]
    extensions = body[pos + 2 : pos + 2 + total]

    sni = ""
    alpn = []
    pos = 0
    while pos + 4 <= len(extensions):
        kind, length = struct.unpack("!HH", extensions[pos : pos + 4])
        payload = extensions[pos + 4 : pos + 4 + length]
        if kind == 0:
            sni = _parse_sni(payload)
        elif kind == 16:
            alpn = _parse_alpn(payload)
        pos += 4 + length

    return _blank(
        kind="tls",
        host=sni,
        url="https://" + sni if sni else "",
        sni=sni,
        alpn=alpn,
    )


def _parse_dns(data):
    if len(data) < 12:
        return None
    if struct.unpack("!H", data[4:6])[0] < 1:
        return None
    pos = 12
    labels = []
    while pos < len(data):
        length = data[pos]
        pos += 1
        if length == 0:
            break
        if length & 0xC0 or pos + length > len(data):
            return None
        labels.append(data[pos : pos + length].decode("ascii", "replace"))
        pos += length
    if not labels or pos + 4 > len(data):
        return None
    qtype = struct.unpack("!H", data[pos : pos + 2])[0]
    name = ".".join(labels)
    return _blank(
        kind="dns",
        host=name,
        url=name,
        dns_name=name,
        dns_type=DNS_TYPES.get(qtype, str(qtype)),
    )


def parse_payload(data, dst_port=0):
    """按 HTTP → TLS → DNS → 文本/二进制的顺序识别；空内容返回空字段。"""
    data = bytes(data or b"")
    if not data:
        return _blank()

    parsed = _parse_http(data)
    if parsed is not None:
        return parsed
    parsed = _parse_tls(data)
    if parsed is not None:
        return parsed
    if dst_port == 53:
        parsed = _parse_dns(data)
        if parsed is not None:
            return parsed

    text = _text_of(data)
    if text is not None:
        return _blank(kind="text", preview=text[:MAX_PREVIEW], preview_encoding="text")
    return _blank(kind="binary", preview=data[:MAX_BINARY].hex(), preview_encoding="hex")
