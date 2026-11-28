# zipx

压缩、解压、校验与包内增删，只处理 zip。

## 安装

仓库根目录执行 `./install.sh`。需要 `zip` 与 `unzip`。

## 用法

```
zipx                     打开菜单
zipx pack 目录 文件        打包
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
