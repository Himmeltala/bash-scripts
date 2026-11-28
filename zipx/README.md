# zipx

把 `zip` 与 `unzip` 的常用操作收进一个界面：压缩、解压、查看校验、包内增删。只处理 zip。

## 安装

仓库根目录执行 `./install.sh`。需要 `zip` 与 `unzip`。

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

不带参数进菜单；只给条目没给动作时按 `pack` 处理。包名默认取当前目录名，解压目标默认当前目录。`pack` 默认把 `.git`、`node_modules`、`target` 一起打进去；要跳过用 `--exclude 模式`，可重复。

## 约定

- `pack` 撞同名包直接拒绝，覆盖加 `--overwrite`。
- 解压默认不覆盖同名文件，覆盖加 `--overwrite`。
- 删包内条目前确认；非交互环境必须加 `--yes`。
- 解压前拒绝绝对路径、Windows 盘符与含 `..` 的条目，防止 zip slip。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 操作失败：包读不了、包坏了、没有可打包内容、找不到条目 |
| 2 | 用法错误 |
| 3 | 用户取消，或删条目未确认 |
