# zipx

把 `zip` / `unzip` 的常用操作收进一个界面：压缩、解压、查看校验、包内增删。只管 zip，不管 tar.gz 与 7z。

## 用法

```
zipx                     打开菜单
zipx pack 目录 文件        打包，默认不排除任何内容
zipx pack -o 名字.zip 目录
zipx unpack 包.zip         解到当前目录
zipx unpack 包.zip -d 目录
zipx extract 包.zip 条目   只提取指定条目
zipx list 包.zip           列出包内文件
zipx test 包.zip           校验完整性
zipx add 包.zip 文件       追加进已有包
zipx rm 包.zip 条目 -y     删除包内条目
zipx -n ...               只打印命令，不落盘
```

不带参数进菜单；只给条目没给动作时按 `pack` 处理。包名默认取当前目录名，解压目标默认当前目录。

## 安全约定

- `pack` 撞上同名包直接拒绝，覆盖要加 `--overwrite`。
- 解压默认不覆盖同名文件，覆盖要加 `--overwrite`。
- 删包内条目前要确认；非交互环境必须加 `--yes`。
- 解压前拒绝绝对路径、Windows 盘符与含 `..` 的条目，防止 zip slip。
- 非交互环境探不到终端时退回编号输入，输入用尽按取消处理。

## 排除与编码

`pack` 默认连 `.git`、`node_modules`、`target` 也打进去；要跳过就用 `--exclude 模式`，可重复。

新版 `zip` 打的包带 UTF-8 标记，Windows 解压正常；老工具在 Windows 上打的包是 GBK 字节且无标记，unzip 会解出乱码，`unzip 6.00` 没有开关能改，只能换 7z 或 bsdtar。脚本检测到成片的框线/块字符时会提示。

## 退出码

| 码 | 含义 |
| -- | --- |
| 0 | 成功 |
| 1 | 操作失败：包读不了、包坏了、没有可打包内容、找不到条目 |
| 2 | 用法错误 |
| 3 | 用户取消，或删条目未确认 |

`unzip` 自身的 9、10、50 等退出码统一收成 1。
