# netx

旁路记录 WSL 内进程的出网连接：谁、什么时候、连了哪、发了多少，并尽量解析出明文内容与域名信息。不改程序、不装证书、不代理流量，也不解密 HTTPS 正文。

## 用法

```
sudo netx web                 网页看板，默认 8400，绑所有网卡
sudo netx web --port 8401     换端口
sudo netx web --host 127.0.0.1  只给本机
sudo netx web --open          顺带打开浏览器
sudo netx daemon              只跑采集，不开网页
netx flows                    最近 15 分钟的连接
netx flows --minutes 60       改时间范围
netx flows --all --json       全部记录，给脚本读
netx status                   采集器状态
netx clean --before 7d --dry-run  预览清理
netx clean --before 7d        删除 7 天前的已结束连接
netx clean --all --yes        删除全部已结束连接
sudo netx web --allow-write   允许其他机器发起清理
```

采集要 root（eBPF），查记录与清理不需要。`sudo` 默认不带用户 PATH，找不到命令时用 `sudo "$(command -v netx)" web`。

依赖 `bpftrace`：

```bash
sudo apt install bpftrace
```

## 网页界面

页面源码在 `netx/web`，与 nodex、jvmx、dvcsx、llmx 共用 `lib/web-shared` 的主题、提示与构建配置，Vite 打包到 `netx/lib/netx/static`。仓库里带着构建产物，改页面后重新构建：

```bash
npm --prefix netx/web ci
npm --prefix netx/web run build
```

看板通过 SSE 收推送，左侧可选时间范围并按进程、PID、地址或域名搜索；详情按需读取，侧栏显示数据库占用并提供清理入口。清理只动已结束的连接，正在传输的会保留；写操作默认只认本机，其他机器要显式放开。`/__netx/api/flows` 与 `/__netx/api/status` 仍可给脚本用。构建前端需要 `node` 与 `npm`。

页面没有登录，抓到的请求里可能带密码、Token 或 Cookie；默认绑所有网卡时同网段都能看。只看本机时加 `--host 127.0.0.1`。

## 看得到什么

- 连接：时间、进程、可执行文件、目标地址与端口、发送字节、持续时长。TCP 与 UDP 都记，没 connect 的 `sendto` 也能按目的地址归并。
- 明文请求：HTTP/1.x 的方法、地址、请求头与正文开头；DNS 查询名；裸 TCP/UDP 的文本或十六进制预览。
- 域名信息：TLS 握手阶段的 SNI 与 ALPN，知道连了哪个站；正文仍是密文。
- 请求里的凭据按原样保留，不额外打码。
- 每条连接只留开头有限长度，超出只计数；内容缺失或截断时界面会标明。
- 进程退出前最后一批字节在 bpftrace 的 map 里，等下一次快照（2 秒）补上后再结束这条 flow。
- 网页通过 SSE 每 3 秒收一次推送，断线由浏览器自己重连。

数据在 `~/.cache/netx/netx.db`（权限 0600）。用 sudo 跑时按 `SUDO_UID` 落到调用者家目录，普通用户仍能读，也能自己清理。

## 现在的缺口

- 只看得到 WSL 内的进程，Windows 侧的程序不经过这里。
- HTTPS、QUIC、ECH 的正文看不到，只有握手阶段能见的域名信息；HTTP/2、HTTP/3 的头部不解析。
- 高流量下可能丢内容事件；这是旁路采集，不保证每一字节都留下。
- 不按内容拦截；连接级阻断在后面阶段。
- 子进程继承父进程的套接字后，子进程写的字节按 `(pid, fd)` 归不到父进程的连接上。
- bpftrace 的 map 上限调到了 262144 个键；正常桌面能用很久，长跑占满后需要重启采集进程。
- 静态链接或非 x86_64 的机器没有验证过。

## 测试

```bash
./test/run.sh
```

测试用假事件与临时数据库，不需要 root，也不产生真实流量。
