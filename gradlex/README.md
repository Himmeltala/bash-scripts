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

| 命令 | 目标 | 任务 |
| --- | --- | --- |
| `run` | Spring Boot、application 或 web 模块 | `bootRun` / `run` / `appRun` / `tomcatRun` / `jettyRun` |
| `build` | 同一批模块 | `bootJar` / `assemble` |

纯库模块不进入清单。

## Gradle 入口

按顺序取 `GRADLEX_GRADLE`、最近的 `gradlew`、`PATH` 里的 `gradle`。强制用系统 Gradle：

```bash
GRADLEX_GRADLE=gradle gradlex run
```

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 执行失败，或没找到目标 |
| 2 | 用法错误 |
| 3 | 用户取消 |
