# portx

按端口查占用进程，或浏览监听端口。

## 安装

仓库根目录执行 `./install.sh`。需要 `ss` 或 `lsof`。

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
