"""监听地址与回环判断：三个网页进程对 --host 的口径保持一致。"""

import ipaddress
import socket


def is_any_host(host):
    """0.0.0.0 与 :: 都是「所有网卡」，不能拿来当访问地址；空串也按这个算。"""
    return host in ("0.0.0.0", "::", "")


def is_loopback_address(addr):
    """一个请求地址是不是本机；IPv6 监听时的 ::ffff:127.0.0.1 也算。"""
    try:
        ip = ipaddress.ip_address((addr or "").split("%", 1)[0])
    except ValueError:
        return False
    if ip.version == 6 and ip.ipv4_mapped:
        return ip.ipv4_mapped.is_loopback
    return ip.is_loopback


def is_loopback_host(host):
    """--host 给的名字是不是只在本机：localhost 与回环 IP 都算。"""
    if host == "localhost":
        return True
    return is_loopback_address(host)


def parse_host(text):
    """--host 只收 localhost 或 IP 地址；别的抛 ValueError。"""
    if text == "localhost":
        return text
    try:
        ipaddress.ip_address(text)
    except ValueError:
        raise ValueError("--host %s 不是 IP 地址" % text)
    return text


def guess_lan_address():
    """猜一个局域网里能用的本机地址，猜不出来退回回环；只让内核选出口网卡，不真发包。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 9))  # TEST-NET-1，不会真连上
            address = probe.getsockname()[0]
        if address and not is_loopback_address(address):
            return address
    except OSError:
        pass
    try:
        address = socket.gethostbyname(socket.gethostname())
        if address and not is_loopback_address(address):
            return address
    except OSError:
        pass
    return "127.0.0.1"


def host_url(host, port):
    """监听地址对应的访问 URL；监听全地址时换成猜出来的局域网地址。"""
    if is_any_host(host):
        host = guess_lan_address()
    return "http://%s:%d/" % (host, port)
