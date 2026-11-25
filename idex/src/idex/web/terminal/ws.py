"""最小 WebSocket 服务端：握手计算与帧编解码，不依赖第三方库。"""

import base64
import hashlib
import struct

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_PAYLOAD = 16 * 1024 * 1024

OP_CONT = 0x0
OP_TEXT = 0x1
OP_BINARY = 0x2
OP_CLOSE = 0x8
OP_PING = 0x9
OP_PONG = 0xA


def accept_key(key):
    """Sec-WebSocket-Accept：客户端 key 拼上固定 GUID 后取 SHA1 再 base64。"""
    digest = hashlib.sha1((key or "").strip().encode("ascii") + GUID.encode("ascii")).digest()
    return base64.b64encode(digest).decode("ascii")


def encode_frame(opcode, payload=b""):
    """服务端发出的帧不加掩码；长度按 7/16/64 位三档。"""
    data = payload.encode("utf-8") if isinstance(payload, str) else bytes(payload)
    header = bytearray([0x80 | (opcode & 0x0F)])
    size = len(data)
    if size < 126:
        header.append(size)
    elif size < 65536:
        header.append(126)
        header.extend(struct.pack("!H", size))
    else:
        header.append(127)
        header.extend(struct.pack("!Q", size))
    return bytes(header) + data


def recv_exact(sock, count):
    """从 socket 读满 count 字节；连接关闭返回空字节。"""
    buf = bytearray()
    while len(buf) < count:
        chunk = sock.recv(count - len(buf))
        if not chunk:
            return b""
        buf.extend(chunk)
    return bytes(buf)


def read_frame(sock):
    """读一帧，返回 (fin, opcode, payload)；连接关闭返回 (False, None, b"")。"""
    head = recv_exact(sock, 2)
    if len(head) < 2:
        return False, None, b""
    first, second = head[0], head[1]
    fin = bool(first & 0x80)
    opcode = first & 0x0F
    masked = bool(second & 0x80)
    size = second & 0x7F
    if size == 126:
        raw = recv_exact(sock, 2)
        if len(raw) < 2:
            return False, None, b""
        size = struct.unpack("!H", raw)[0]
    elif size == 127:
        raw = recv_exact(sock, 8)
        if len(raw) < 8:
            return False, None, b""
        size = struct.unpack("!Q", raw)[0]
    if size > MAX_PAYLOAD:
        return False, None, b""
    mask = recv_exact(sock, 4) if masked else b""
    if masked and len(mask) < 4:
        return False, None, b""
    payload = recv_exact(sock, size) if size else b""
    if size and len(payload) < size:
        return False, None, b""
    if masked:
        payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
    return fin, opcode, payload


def read_message(sock):
    """读一条完整消息，按需拼接分片；控制帧原样返回。"""
    fin, opcode, payload = read_frame(sock)
    if opcode is None or opcode >= OP_CLOSE:
        return opcode, payload
    data = bytearray(payload)
    while not fin:
        fin, next_opcode, more = read_frame(sock)
        if next_opcode is None:
            return None, b""
        if next_opcode >= OP_CLOSE:
            return next_opcode, more
        data.extend(more)
    return opcode, bytes(data)
