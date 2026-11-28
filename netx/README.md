# netx

旁路记录 WSL 内进程的出网连接与可解析的明文内容，不做代理，不解密 HTTPS 正文。

## 安装

仓库根目录执行 `./install.sh`。采集需要 `bpftrace` 与 root：

```bash
sudo apt install bpftrace
```

## 用法

```
sudo netx web                   网页看板，默认 8400，绑所有网卡
sudo netx web --port 8401       换端口
sudo netx web --host 127.0.0.1  只给本机
sudo netx web --open            顺带打开浏览器
sudo netx web --allow-write     允许其他机器发起清理
sudo netx daemon                只跑采集，不开网页
netx flows                      最近 15 分钟的连接
netx flows --minutes 60         改时间范围
netx flows --all --json         全部记录，给脚本读
netx status                     采集器状态
netx clean --before 7d          删除 7 天前的已结束连接
netx clean --before 7d --dry-run  预览清理
netx clean --all --yes          删除全部已结束连接
```

采集要 root，查记录与清理不需要。页面没有登录，默认绑所有网卡；只看本机加 `--host 127.0.0.1`。
