# netx

旁路记录 WSL 内进程的出网连接：谁、什么时候、连了哪、发了多少。不改程序、不装证书、不代理流量。

当前是阶段一，只记连接元数据与发送字节；主机名（SNI/DNS）、敏感文件与内容检测、按程序阻断在后面阶段。

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
```

采集要 root（eBPF），查记录不要。`sudo` 默认不带用户 PATH，找不到命令时用 `sudo "$(command -v netx)" web`。

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

看板通过 `/__netx/api/flows/stream` 收 SSE 推送，左侧可选时间范围，表格可按进程、PID 或目标地址搜索；`/__netx/api/flows` 与 `/__netx/api/status` 仍可给脚本用。构建前端需要 `node` 与 `npm`。

## 记录什么

- 连接：时间、PID、UID、进程名、可执行文件、地址族、目标 IP 与端口、发送字节、持续时长。TCP 与 UDP 都记，没 connect 的 `sendto` 也能按目的地址归并。
- 进程退出前最后一批字节在 bpftrace 的 map 里，等下一次快照（2 秒）补上后再结束这条 flow。
- 网页通过 `/__netx/api/flows/stream` 每 3 秒收一次 SSE 推送，断线由浏览器自己重连。

数据在 `~/.cache/netx/netx.db`（权限 0600）。用 sudo 跑时按 `SUDO_UID` 落到调用者家目录，普通用户仍能读。

## 现在的缺口

- 只看得到 WSL 内的进程，Windows 侧的程序不经过这里。
- HTTPS 只记目标 IP 与字节，看不到域名；TLS 首包已经在抓，SNI 解析在阶段二。
- QUIC、ECH 只看得到五元组。
- 不按内容拦截；连接级阻断在阶段三。
- 子进程继承父进程的套接字后，子进程写的字节按 `(pid, fd)` 归不到父进程的连接上。
- bpftrace 的 map 上限调到了 262144 个键；正常桌面能用很久，长跑占满后需要重启采集进程。
- 静态链接或非 x86_64 的机器没有验证过。

## 测试

```bash
./test/run.sh
```

测试用假事件与临时数据库，不需要 root，也不产生真实流量。
