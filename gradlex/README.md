# gradlex

递归查找 Gradle 构建与可运行模块，勾选后启动或构建。

## 安装

仓库根目录执行 `./install.sh`。需要 Gradle 或工程自带的 `gradlew`。

## 用法

```
gradlex                 先选命令，再勾目标
gradlex run|build
gradlex admin           有参数时按标签或路径匹配，跳过界面
gradlex run admin       命令在前，关键词在后
gradlex --list          只列目标（默认按 run 列）
gradlex --rebuild       任务前加 clean
gradlex --refresh       追加 --refresh-dependencies
gradlex --reset         清掉当前命令的勾选
```
