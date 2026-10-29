# gradlex

省去手敲 `gradle :模块:bootRun` 这类长命令。从当前目录递归找出 Gradle 构建与可运行模块，勾选后启动或构建。

## 用法

```
gradlex                 先选命令，再勾目标
gradlex run             同上，显式写命令名
gradlex build           构建可运行模块
gradlex admin           带关键词时跳过界面，按子串匹配标签或路径后直接执行
gradlex run admin       先写命令名，再写关键词
gradlex --list          只列出目标，不执行；没写命令时按 run 列
gradlex --rebuild       任务前加 clean，先清理再执行
gradlex --refresh       追加 --refresh-dependencies，强制刷新依赖
gradlex --reset         清掉当前命令上次的勾选记录，重新开始
gradlex --help          显示帮助，命令清单从注册表生成
```

不带参数时打开主菜单：先选命令（启动、构建、退出），再进目标勾选；一个命令执行完回到菜单，只有选退出才离开。给了命令名或关键词时跳过菜单直接执行。

界面用方向键移动，用空格勾选，用回车确认；按 `←` 或 `b` 返回上一步，按 `q` 取消。上次勾过的目标下次自动预勾选。从主菜单进入时，返回后回到命令选择；直接写命令时没有上一步，返回等同于取消。

勾选一个目标时，脚本用 `exec` 把自身进程整个换成 Gradle，输出、颜色与 Ctrl+C 行为都和手敲完全一样。勾选多个时全部后台执行，输出仍然直接打在当前终端上，脚本只在最后等待。按一次 Ctrl+C，信号送到整个前台进程组，所有任务一起退出。

非交互环境（管道、脚本、CI）下探不到终端，自动退回编号输入，避免界面卡住。

## 两条命令

| 命令 | 目标 | 执行的 Gradle 任务 |
| --- | --- | --- |
| `run` | 可运行的 Spring Boot 或 application 模块 | Spring Boot 模块 `bootRun`，application 模块 `run` |
| `build` | 与 `run` 同一批模块 | Spring Boot 模块 `bootJar`，application 模块 `assemble` |

`build` 与 `run` 使用同一批目标，纯库模块不进入清单。

## 目标判定

`run` 与 `build` 看同一批模块：

- 应用了 Spring Boot 插件，并且 `src/main/java` 或 `src/main/kotlin` 下存在带 `@SpringBootApplication` 的类。
- 或者应用了 `application` 插件，并且声明了 `mainClass` / `mainClassName`，或存在带 `public static void main` / `fun main` 的类。

插件可以写在三个位置：

1. 模块自己的 `build.gradle` / `build.gradle.kts`。
2. 构建根 `build.gradle` 的 `project(":名字") { apply plugin: ... }` 块。
3. 构建根 `build.gradle` 的 `subprojects { ... }` 或 `allprojects { ... }` 块。

构建根顶部的 `plugins { id 'org.springframework.boot' }` 只作用于根项目，不会把子模块都算成可运行模块。

## 构建根与模块

从当前目录递归查找 `settings.gradle` 与 `settings.gradle.kts`，跳过 `build`、`.gradle`、`.git`、`.svn`、`node_modules`、`.idea`、`.settings`、`out`、`target`。每个 settings 文件对应一个构建根。

当前目录及其子目录没有 settings 时，从当前目录向上找最近的构建根，支持在子模块目录里直接运行。再找不到时，若当前目录有 `build.gradle` 或 `build.gradle.kts`，按单项目构建处理。

解析 `include` 时支持：

```groovy
include 'app', ':lib'
include(
  ':worker'
)
```

```kotlin
include(":app", ":lib")
```

模块目录默认为 `<构建根>/<路径>`，路径里的 `:` 换成 `/`。`project(":名字").projectDir = file("...")` 可以覆盖目录。settings 里 include 了但目录不存在的模块会被跳过。

## Gradle 入口

按以下优先级选择：

1. 环境变量 `GRADLEX_GRADLE`。
2. 从构建根向上最近的 `gradlew`；不可执行时用 `sh gradlew`。
3. PATH 里的 `gradle`。

`gradlew` 带 CRLF 换行时在 Linux 上跑不起来（shebang 会带上 `\r`，`sh` 又把行尾 `\r` 当命令）。这种情况会打一行警告，然后改用系统 `gradle`；系统 `gradle` 也没有时才报错退出。想强制用系统 Gradle：

```bash
GRADLEX_GRADLE=gradle gradlex run
```

## 执行方式

命令在构建根执行，项目路径用 Gradle 的 `:模块:任务` 形式：

```
gradle :runnet-nhssp-service:bootRun
```

模块是根项目时直接执行 `gradle bootRun`。

默认不 clean，不跳过编译，增量交给 Gradle 自己判断。Gradle 没有 Maven `maven.main.skip` 的等价参数，强跳编译容易跑到旧代码，所以 `gradlex` 不做自动跳过编译。

两个可选参数：

| 参数 | 行为 |
| --- | --- |
| `--rebuild` | 任务前加 `clean`，执行 `:模块:clean :模块:bootRun` |
| `--refresh` | 追加 `--refresh-dependencies` |

两个参数可以同时写。

## 勾选记录

存在 `~/.cache/gradlex/<当前目录的哈希>.<命令名>.selected`，按「所在目录加命令」分开记，`run` 的勾选不会串到 `build` 上。`--reset` 只清当前目录当前命令这一份。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 找到了目标但执行失败，或者当前目录下没找到目标 |
| 2 | 用法错误：未知选项 |
| 3 | 用户取消：在菜单或勾选界面里取消，或者确认时一个都没勾 |

## 安全约定

- 只在 `--rebuild` 时执行 `clean`。
- 不修改源码，不删除构建产物，不终止 Gradle 守护进程。
- wrapper 带 CRLF 或不可执行时报告；CRLF 会警告后改用系统 `gradle`，没有 `gradle` 才退出。
- 勾选记录只写缓存目录（`~/.cache/gradlex`）。

## 文件结构

```
gradlex/
├── README.md
├── bin/
│   └── gradlex             唯一入口：定位核心、转发参数
├── lib/
│   ├── gradlex-core.sh     加载器，按顺序 source 下面各文件
│   └── gradlex/
│       ├── util.sh         退出码、报错、终端探测、记录分列、路径计算
│       ├── scan.sh         构建根、settings、模块与任务判定
│       ├── ui.sh           界面组装与勾选记录
│       ├── exec.sh         Gradle 入口选择、参数拼装、起进程
│       ├── cli.sh          注册表、帮助、参数解析、动作分发与主菜单
│       └── commands/
│           ├── run.sh
│           └── build.sh
└── test/
    └── run.sh              临时目录下的回归测试
```

界面组件在独立仓库 `bash-tui`，由仓库根下的 `lib/tui-path.sh` 定位，不在上面的目录树里。加载器直接执行也行，等价于 `gradlex`，调试某一步时方便。

安装脚本只把 `bin` 下的文件软链成命令，`lib` 不会出现在 PATH 里。

## 加新命令

`lib/gradlex/cli.sh` 顶部有一张注册表，每行六列，用竖线隔开：

```
命令名 | 说明 | 收集函数 | 目标的名词 | 参与构建参数 | 选择函数
```

在 `lib/gradlex/commands/` 下加一个文件写收集函数，函数里遍历 `MODULE_DIRS`、对每个目标调用一次 `emit_record`。文件名随命令名，加载器按通配 source，主菜单也从注册表生成。

记录六列，顺序是：

```
标签、工作目录、Gradle 项目路径、任务参数、展示用相对路径、展示用命令
```

项目路径单独占一列而不是先拼进参数字符串，是为了执行时能加引号，路径含空格时才不会被拆成两个参数。

## 测试

```bash
gradlex/test/run.sh
```

测试在临时目录构造 Gradle 工程，覆盖 Groovy/Kotlin settings、三种插件位置、`projectDir` 覆盖、纯库过滤、单项目、Gradle 入口选择，以及用假 gradle 验证真正传出的参数。测试不编译、不启动真实项目。

## 已知限制

- 只解析常见的 Groovy 与 Kotlin DSL 写法，复杂的动态 `include` 不识别。
- 不支持 composite build 与 `includeBuild`。
- 不解析 `gradle.properties` 中的任务覆盖。
- 只识别 Spring Boot 与 application 两类可运行模块。
- 清单只列可运行模块，纯库模块不会出现在 `build` 里。
