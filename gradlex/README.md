# gradlex

从当前目录递归找 Gradle 构建与可运行模块，勾选后启动或构建，省去手敲 `gradle :模块:bootRun`。

## 用法

```
gradlex                 先选命令，再勾目标
gradlex run|build
gradlex admin           带关键词时跳过界面，直接匹配标签或路径
gradlex run admin       命令在前，关键词在后
gradlex --list          只列目标；默认按 run 列
gradlex --rebuild       任务前加 clean
gradlex --refresh       追加 --refresh-dependencies
gradlex --reset         清掉当前命令的勾选记录
```

| 命令 | 目标 | 任务 |
| --- | --- | --- |
| `run` | Spring Boot、application 或 web 模块 | `bootRun` / `run` / `appRun` / `tomcatRun` / `jettyRun` |
| `build` | 同一批模块 | `bootJar` / `assemble` |

纯库模块不进入清单。

## 目标判定

模块自己的 `build.gradle(.kts)`、构建根的 `project(":名字") { apply plugin }` 或 `subprojects` / `allprojects` 块里应用了 Spring Boot 插件，且 `src/main/java` 或 `src/main/kotlin` 下有 `@SpringBootApplication`；或者应用了 `application` 插件并声明了 `mainClass` / `mainClassName`，或存在 `main` 方法。war 项目按 `appRun`（gretty）、`tomcatRun`（`com.bmuschko.tomcat`）、`jettyRun`（旧版内置 `jetty` 插件）的顺序认，都要求 `src/main/webapp` 存在，或在构建文件里用 `webAppDir` 改过 web 根。构建根顶部的 `plugins` 只作用于根项目。

## 构建根与入口

从当前目录向下找 `settings.gradle(.kts)`，每个文件是一个构建根；向下找不到就向上找，再没有则把带 `build.gradle(.kts)` 的当前目录当单项目。递归跳过 `build`、`.gradle`、`.git`、`.svn`、`node_modules`、`.idea`、`.settings`、`out`、`target`。`include` 支持单行、多行与 Kotlin 写法；`project(":名字").projectDir` 可以改目录；include 了但目录不存在就跳过。

入口按顺序取：`GRADLEX_GRADLE`、最近的 `gradlew`（不可执行时用 `sh gradlew`）、PATH 里的 `gradle`。`gradlew` 带 CRLF 时先警告并改用系统 `gradle`，都没有才报错。强制用系统 Gradle：

```bash
GRADLEX_GRADLE=gradle gradlex run
```

## 执行

在构建根执行 `gradle :模块:任务`；模块是根项目时直接 `gradle bootRun`。默认不 clean、不跳过编译，增量交给 Gradle。`--rebuild` 在任务前加 `clean`，`--refresh` 追加 `--refresh-dependencies`，可以同时用。

勾选记录存在 `~/.cache/gradlex/<目录哈希>.<命令>.selected`，`--reset` 只清当前目录当前命令那份。

## 退出码

| 码 | 含义 |
| -- | --- |
| 0 | 成功 |
| 1 | 执行失败，或没找到目标 |
| 2 | 用法错误 |
| 3 | 用户取消 |

## 约定

- 只在 `--rebuild` 时 `clean`；不改源码、不删构建产物、不杀 Gradle 守护进程。
- 勾选记录只写 `~/.cache/gradlex`。
- 没有终端时退回编号输入，语义与退出码不变。
