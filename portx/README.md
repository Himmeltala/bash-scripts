# portx

按端口查占用进程，或浏览当前监听端口。默认只读；`-k` 才结束进程，系统级端口还要 `--force`。

## 安装

在仓库根目录执行 `./install.sh`。需要 `ss` 或 `lsof`。

## 用法

```
portx                        打开菜单
portx 8080                   查占用 8080 的进程
portx 8080 8081              一次查多个端口
portx -l                     列出全部监听端口
portx -l -u                  连 UDP 一起列
portx -u 5353                连 UDP 一起查
portx -n 8080                只列进程，不发信号
portx -k 8080                结束进程（先 SIGTERM）
portx -k -9 8080             直接 SIGKILL
portx -k -s INT 8080         发指定信号
portx -k -t 10 8080          等 10 秒，默认 5 秒
portx -k -y 8080             跳过确认
portx -k --force 3306        放行受保护端口
```

不带参数进菜单，可选按端口查询或浏览监听端口。查询不需要 `--force`。

`-k` 先发 SIGTERM，超时后询问是否补 SIGKILL；stdin 不是终端时确认一律按否。受保护端口只在 `-k` 时生效，必须加 `--force`：0-1023 与常见服务默认端口。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 没监听、拿不到 pid、信号没送到或进程没退出 |
| 2 | 用法错误 |
| 3 | `-k` 撞上受保护端口且没有 `--force` |
