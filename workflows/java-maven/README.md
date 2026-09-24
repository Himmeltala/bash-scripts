# java-maven

Java Maven 工作流下的工具。

## mvnstart

省掉手敲 `mvn -pl <模块> spring-boot:run` 那一长串。从当前目录递归找出可运行的模块或可构建的项目，弹出复选清单，勾选后执行。

### 用法

```
mvnstart                 在当前目录下递归找可运行模块，弹出复选清单
mvnstart run            同上，显式写命令名
mvnstart install        找顶层项目，勾选后执行构建
mvnstart admin          带关键词时跳过界面，按子串匹配标签或路径后直接执行
mvnstart install 人影   先写命令名，再写关键词
mvnstart --list         只列出目标，不执行
mvnstart --refresh      清掉当前命令上次的勾选记录，重新开始
mvnstart --help         显示帮助，命令清单从注册表生成
```

界面用方向键移动、空格勾选、回车确认。上次勾过的目标下次自动预勾选。

勾选一个目标时，脚本用 `exec` 把自身进程整个换成 `mvn`，输出、颜色、Ctrl+C 与手敲完全一样。勾选多个时全部后台执行，输出仍然直接打在当前终端上，脚本只在最后等着；按一次 Ctrl+C，信号送到整个前台进程组，所有任务一起优雅退出。

非交互环境（管道、脚本、CI）下探不到终端，自动退回编号输入，避免 whiptail 卡住。

### 两条命令

| 命令 | 目标 | 执行的 Maven 命令 |
| --- | --- | --- |
| `run` | 可运行的 Spring Boot 模块 | `mvn -pl <模块路径> spring-boot:run` |
| `install` | 顶层项目 | `mvn clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true` |

`install` 带 `maven.resources.skip`，装出来的 jar 里没有 `application.yml` 这类资源，用途是快速把依赖补齐进本地仓库，让 `run` 能解析到兄弟模块，不适合拿去部署。

### 目标的判定

`run` 三条同时满足：自己的 pom 里引了 `spring-boot-maven-plugin`、打包方式不是 `pom`、`src/main/java` 下确实存在带 `@SpringBootApplication` 的类。父 pom 与 common 这类纯依赖模块会被滤掉。

`install` 判定顶层项目：没有被任何上层聚合 pom 的 `<modules>` 收录的 pom。

递归时跳过 `target`、`.svn`、`.git`、`node_modules`、`.idea`、`.settings`。

### 启动命令怎么拼

模块能被某个上层聚合 pom 声明走到时，从该聚合根目录执行 `mvn -pl <相对路径> spring-boot:run`；走不到时进入模块目录执行 `mvn spring-boot:run`。

聚合根取的是**最外层**那个能走到模块的 pom。以 `runnet-admin-service` 为例，它既能由 `runnet-admin` 寻址，也能由 `backend` 寻址，脚本选 `backend`，拼出来是：

```
cd .../runnet-national-figures-v2.0/backend
mvn -pl runnet-admin/runnet-admin-service spring-boot:run
```

与手工在项目根目录下敲的形式一致。Maven 的 `-pl` 接受指向嵌套模块的路径，即便该模块没有被根 pom 直接声明。

### 同名目标

大范围扫描时，不同项目里会同时存在 `runnet-admin-service` 这类同名模块。脚本给重名的补上最短的唯一路径尾巴，段数按同名分组统一取：

```
runnet-admin-service@back-end/runnet-admin/runnet-admin-service
runnet-admin-service@backend/runnet-admin/runnet-admin-service
```

### 勾选记录

存在 `~/.cache/mvnstart/<当前目录的哈希>.<命令名>.selected`，按「所在目录加命令」分开记，`run` 的勾选不会串到 `install` 上。`--refresh` 只清当前目录当前命令这一份。

### 加新命令

脚本顶部有一张注册表，每行四列，用竖线隔开：

```
命令名 | 说明 | 收集函数 | 目标的名词
```

加一条命令要做两件事：在 `COMMANDS` 里加一行，再写一个收集函数，函数里遍历 `POM_LIST`、对每个目标调用一次 `emit_record`。记录六列，顺序是：

```
标签、工作目录、-pl 的值（不走 -pl 时为空）、mvn 参数、展示用相对路径、展示用命令
```

`-pl` 的值单独占一列而不是先拼进参数字符串，是为了执行时能加引号，路径含空格时才不会被拆成两个参数。

### 实现上要注意的坑

改这个脚本之前先看这几条，都是踩过一遍的。

- **记录内部不能用制表符分列。** 制表符属于 IFS 空白，`read` 会把连续两个并成一个，空字段（不走 `-pl` 的目标）直接丢掉，后面字段整体错位，表现为工作目录被当成 mvn 参数。改用 ASCII 单元分隔符。
- **whiptail 的 checklist 结果写在 stderr 上**，不是 stdout，这一点与 dialog 相反，`man whiptail` 的 `--checklist` 一节写明了。取结果要用 `3>&1 1>&2 2>&3`。
- **函数末尾以 `[[ 条件 ]] && {...}` 收尾时，条件判假会让函数返回 1**，调用方会当成失败。回传结果的函数要显式 `return 0`。
- **记忆化必须建在主 shell 里。** `can_reach` 之类是在命令替换与进程替换的子 shell 里跑的，子 shell 里对数组的写入会随子 shell 一起丢掉，缓存等于没建。改成扫描开始时在主 shell 里统一解析、填进数组，子 shell 只读。
- **awk 遇到含 `<parent>` 的行不能整行 `next`。** pom 若把 `<parent>` 与项目自身坐标写在同一行，整行跳掉会把 `artifactId` 一起丢掉。要只摘掉行内的 parent 片段。
- **机器性能决定写法。** 在开发这台机器上，fork 一次约 10 毫秒，bash 对 14KB 文本做一次模式匹配约 1 毫秒。所以整份 pom 的文本处理全部交给 awk、一次调用取全所需信息，bash 只碰短字符串。任何「每个 pom 多跑一遍 grep」的写法都会累积成秒级开销。
- **别把入口类检查改成对整个扫描根跑一次 grep。** 从家目录或项目根扫描时，底下压着 `.vscode-server`、`node_modules` 这类大目录，实测比逐个模块查各自的源码目录还慢。

### 已知限制

- 多选只在当前终端里并行起，不给每个目标开独立终端窗口。
- 从 `~/`、`~/projs` 这种大范围扫描一次要几秒，是磁盘与进程派生慢，不是脚本本身的问题；在项目目录里跑通常一秒以内。
