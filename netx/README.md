# netx

旁路记录 WSL 内进程的出网连接：谁、什么时候、连了哪、发了多少，并尽量解析出明文内容与域名信息。不改程序、不装证书、不代理流量，也不解密 HTTPS 正文。

## 安装

在仓库根目录执行 `./install.sh`。采集依赖 `bpftrace` 与 root：

```bash
sudo apt install bpftrace
```

## 用法

```
sudo netx web                 网页看板，默认 8400，绑所有网卡
sudo netx web --port 8401     换端口
sudo netx web --host 127.0.0.1  只给本机
sudo netx web --open          顺带打开浏览器
sudo netx web --allow-write   允许其他机器发起清理
sudo netx daemon              只跑采集，不开网页
netx flows                    最近 15 分钟的连接
netx flows --minutes 60       改时间范围
netx flows --all --json       全部记录，给脚本读
netx status                   采集器状态
netx clean --before 7d        删除 7 天前的已结束连接
netx clean --before 7d --dry-run  预览清理
netx clean --all --yes        删除全部已结束连接
```

采集要 root，查记录与清理不需要。`sudo` 默认不带用户 PATH，找不到命令时用 `sudo "$(command -v netx)" web`。

## 网页界面

看板通过 SSE 收推送，可按时间范围、进程、PID、地址或域名筛选；详情按需读取，侧栏显示数据库占用并提供清理入口。清理只动已结束的连接。

页面没有登录，抓到的请求里可能带密码、Token 或 Cookie；默认绑所有网卡时同网段都能看。只看本机就加 `--host 127.0.0.1`。

## 看得到什么

- 连接：时间、进程、可执行文件、目标地址与端口、发送字节、持续时长。
- 明文请求：HTTP/1.x 的方法、地址、请求头与正文开头；DNS 查询名；裸 TCP/UDP 的文本预览。
- 域名信息：TLS 握手阶段的 SNI 与 ALPN，正文仍是密文。
- 每条连接只留开头有限长度，超出只计数。

HTTPS、QUIC、ECH 的正文看不到；高流量下可能丢内容事件；只看得到 WSL 内的进程。

## 测试

```bash
./test/run.sh
```

测试用假事件与临时数据库，不需要 root，也不产生真实流量。
