"""明文内容解析：HTTP、DNS、TLS 与兜底。"""

import struct
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx.parse import parse_payload


def dns_query(name, qtype=1):
    header = struct.pack("!HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0)
    labels = b"".join(bytes([len(part)]) + part.encode() for part in name.split("."))
    return header + labels + b"\x00" + struct.pack("!HH", qtype, 1)


def client_hello(host, alpn):
    name = host.encode()
    sni_body = struct.pack("!H", len(name) + 3) + b"\x00" + struct.pack("!H", len(name)) + name
    sni = struct.pack("!HH", 0, len(sni_body)) + sni_body
    protos = b"".join(bytes([len(item)]) + item.encode() for item in alpn)
    alpn_body = struct.pack("!H", len(protos)) + protos
    alpn_ext = struct.pack("!HH", 16, len(alpn_body)) + alpn_body
    exts = sni + alpn_ext
    body = (
        b"\x03\x03"
        + b"\x11" * 32
        + b"\x00"
        + struct.pack("!H", 2)
        + b"\x13\x01"
        + b"\x01\x00"
        + struct.pack("!H", len(exts))
        + exts
    )
    handshake = b"\x01" + len(body).to_bytes(3, "big") + body
    return b"\x16\x03\x01" + len(handshake).to_bytes(2, "big") + handshake


class ParseTest(unittest.TestCase):
    def test_http_request_fields(self):
        raw = (
            b"POST /api/login?x=1 HTTP/1.1\r\nHost: example.com\r\n"
            b"Authorization: Bearer abc\r\nContent-Length: 7\r\n\r\n{\"a\": 1}"
        )
        parsed = parse_payload(raw)
        self.assertEqual(parsed["kind"], "http")
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["host"], "example.com")
        self.assertEqual(parsed["url"], "http://example.com/api/login?x=1")
        self.assertEqual(parsed["body"], "{\"a\": 1}")
        self.assertEqual(parsed["body_encoding"], "text")
        self.assertTrue(parsed["headers_complete"])
        self.assertIn(["Authorization", "Bearer abc"], parsed["headers"])

    def test_partial_http_headers(self):
        parsed = parse_payload(b"GET /a HTTP/1.1\r\nHost: x.test\r\n")
        self.assertEqual(parsed["kind"], "http")
        self.assertEqual(parsed["host"], "x.test")
        self.assertFalse(parsed["headers_complete"])
        self.assertEqual(parsed["body"], "")

    def test_http_binary_body(self):
        raw = b"POST /upload HTTP/1.1\r\nHost: u.test\r\n\r\n" + bytes(range(0, 16))
        parsed = parse_payload(raw)
        self.assertEqual(parsed["body_encoding"], "hex")
        self.assertTrue(parsed["body"])

    def test_tls_client_hello_sni(self):
        parsed = parse_payload(client_hello("example.org", ["h2", "http/1.1"]))
        self.assertEqual(parsed["kind"], "tls")
        self.assertEqual(parsed["sni"], "example.org")
        self.assertEqual(parsed["alpn"], ["h2", "http/1.1"])
        self.assertEqual(parsed["url"], "https://example.org")

    def test_tls_truncated_after_random(self):
        body = b"\x03\x03" + b"\x11" * 32
        handshake = b"\x01" + len(body).to_bytes(3, "big") + body
        data = b"\x16\x03\x01" + len(handshake).to_bytes(2, "big") + handshake
        parsed = parse_payload(data)
        self.assertEqual(parsed["kind"], "tls")
        self.assertEqual(parsed["sni"], "")

    def test_tls_application_data_stays_binary(self):
        parsed = parse_payload(b"\x17\x03\x03\x00\x05hello")
        self.assertEqual(parsed["kind"], "binary")
        self.assertEqual(parsed["sni"], "")

    def test_dns_query(self):
        parsed = parse_payload(dns_query("example.net"), dst_port=53)
        self.assertEqual(parsed["kind"], "dns")
        self.assertEqual((parsed["dns_name"], parsed["dns_type"]), ("example.net", "A"))

    def test_text_fallback(self):
        parsed = parse_payload(b"hello world")
        self.assertEqual(parsed["kind"], "text")
        self.assertEqual(parsed["preview"], "hello world")

    def test_binary_fallback(self):
        parsed = parse_payload(bytes(range(0, 32)))
        self.assertEqual(parsed["kind"], "binary")
        self.assertTrue(parsed["preview"])

    def test_empty_payload(self):
        parsed = parse_payload(b"")
        self.assertEqual(parsed["kind"], "")


if __name__ == "__main__":
    unittest.main()
