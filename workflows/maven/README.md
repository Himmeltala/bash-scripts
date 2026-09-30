# maven

Maven 工作流下的工具。

## mvnstart

省掉手敲 `mvn -pl <模块> spring-boot:run` 那一长串。从当前目录递归找出可运行的模块或可构建的项目，弹出复选清单，勾选后执行。

### 用法

```
mvnstart                 在当前目录下递归找可运行模块，弹出复选清单
mvnstart run            同上，显式写命令名
mvnstart install        找顶层项目，勾选后执行构建
mvnstart package        找可运行模块，勾选后打成可部署的 jar
mvnstart package --no-am  打包时不构建依赖的兄弟模块
mvnstart admin          带关键词时跳过界面，按子串匹配标签或路径后直接执行
mvnstart install 人影   先写命令名，再写关键词
mvnstart admin -c       强制编译后启动
mvnstart --no-compile   跳过编译，直接跑已有的 class
mvnstart --rebuild      先 clean 再编译后启动
mvnstart --list         只列出目标，不执行
mvnstart --refresh      清掉当前命令上次的勾选记录，重新开始
mvnstart --help         显示帮助，命令清单从注册表生成

mvnstart-run            按命令命名的入口，等价于 mvnstart run
mvnstart-install        等价于 mvnstart install
mvnstart-package        等价于 mvnstart package
mvnstart-package --no-am  入口与命令名可以混着用
```

界面用方向键移动、空格勾选、回车确认。上次勾过的目标下次自动预勾选。

勾选一个目标时，脚本用 `exec` 把自身进程整个换成 `mvn`，输出、颜色、Ctrl+C 与手敲完全一样。勾选多个时全部后台执行，输出仍然直接打在当前终端上，脚本只在最后等着；按一次 Ctrl+C，信号送到整个前台进程组，所有任务一起优雅退出。

非交互环境（管道、脚本、CI）下探不到终端，自动退回编号输入，避免 whiptail 卡住。

### 启动方式

默认会自动判一遍这一条记录要不要编译，另外三条由命令行指定。模式参数只对 `run` 有效，`install` 与 `package` 收到 `--no-compile` 或 `--rebuild` 直接报用法错误退出，装本地仓库与打包都必须真编译。命令行里后面写的覆盖前面的。

| 方式 | 行为 |
| --- | --- |
| 不写 | 源码与各级 pom 都没比 `target/classes` 里最新的 class 新时跳过编译 |
| `-c`, `--compile` | 强制编译，等价于手工敲 `mvn` |
| `--no-compile` | 跳过编译直接跑已有的 class，模块没编过时报错退出（退出码 2） |
| `--rebuild` | 先 `clean` 再编译后启动 |

跳过编译省下的是整个模块的重编时间。Maven 只要发现任何一个源文件没有对应的 class 文件，就会把整个模块重编一遍；整份被注释掉的源文件永远不产出 class，正好一直触发它。实测一个 539 个源文件的模块，一次启动 44.5 秒对 7.8 秒，而源码其实一个字都没改。

判定不跟着 Maven 走，只看时间戳：源码、`target/generated-sources`、模块自身与各级父 pom 里有文件比最新的 class 新，就照常编译。资源不参与判定，拷贝是 `resources` 插件的事，改了 `application.yml` 照样进 `target/classes`。

判定拿不准（没有 `target/classes`、里面一个 class 都没有、路径不存在）一律返回「需要编译」，交给 Maven 自己判：多编一次只是慢，漏编一次就是跑到旧代码。判定猜错时用 `-c` 或 `--rebuild`。

已知盲点一条：删掉源文件后，`target/classes` 里那个旧 class 会留下，光看时间戳看不出变化。这不是跳过编译独有的问题，`mvn compile` 本身也不删残留 class，删类之后都得 `clean`，也就是 `--rebuild`。

### 三条命令

| 命令 | 目标 | 执行的 Maven 命令 |
| --- | --- | --- |
| `run` | 可运行的 Spring Boot 模块 | `mvn -pl <模块路径> spring-boot:run`，尾部参数受启动方式影响 |
| `install` | 顶层项目 | `mvn clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true` |
| `package` | 可运行的 Spring Boot 模块 | `mvn -pl <模块路径> clean package -Dmaven.test.skip=true -am` |

`install` 带 `maven.resources.skip`，装出来的 jar 里没有 `application.yml` 这类资源，用途是快速把依赖补齐进本地仓库，让 `run` 能解析到兄弟模块，不适合拿去部署。

`package` 打的是能拿去部署的 jar，参数有两个开关：

| 开关 | 行为 |
| --- | --- |
| 不写 | `clean package -Dmaven.test.skip=true -am` |
| `--no-am` | 去掉 `-am`，兄弟模块必须已经装进本地仓库，省下拉起它们的时间 |
| `--no-clean` | 去掉 `clean`，增量打包最快，代价是残留的旧 class 会进 jar |

`-am` 让 Maven 连这个模块依赖的兄弟模块一起构建，兄弟模块还没装进本地仓库时也能一次打包成功。跳过测试省下的是编译测试类与跑测试的时间，打出来的是能跑的东西，不是验证过的版本。这两个开关只对 `package` 有效，别的命令带上直接报用法错误退出。

### 目标的判定

`run` 三条同时满足：自己的 pom 里引了 `spring-boot-maven-plugin`、打包方式不是 `pom`、`src/main/java` 下确实存在带 `@SpringBootApplication` 的类。父 pom 与 common 这类纯依赖模块会被滤掉。

`package` 与 `run` 是同一批目标，判定只写一遍，两条命令各自只负责拼自己那条 Maven 命令。

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

`package` 拼路径的方式与 `run` 相同，只是把 `spring-boot:run` 换成打包参数。

### 同名目标

大范围扫描时，不同项目里会同时存在 `runnet-admin-service` 这类同名模块。脚本给重名的补上最短的唯一路径尾巴，段数按同名分组统一取：

```
runnet-admin-service@back-end/runnet-admin/runnet-admin-service
runnet-admin-service@backend/runnet-admin/runnet-admin-service
```

### 勾选记录

存在 `~/.cache/mvnstart/<当前目录的哈希>.<命令名>.selected`，按「所在目录加命令」分开记，`run` 的勾选不会串到 `install` 上。`--refresh` 只清当前目录当前命令这一份。记录按命令名存，`mvnstart-run` 与 `mvnstart run` 共用同一份。

### 文件结构

```
workflows/maven/
├── README.md
├── bin/                     入口，每个只负责定位核心、转发参数
│   ├── mvnstart             默认 run
│   ├── mvnstart-run
│   ├── mvnstart-install
│   └── mvnstart-package
└── lib/
    ├── mvnstart-core.sh     加载器，按顺序 source 下面各文件
    └── mvnstart/
        ├── util.sh          报错、记录分列、路径计算
        ├── pom.sh           pom 扫描与解析、可运行模块判定、聚合根寻址
        ├── ui.sh            勾选界面、勾选记录、同名标签去重
        ├── exec.sh          启动方式与编译判定、起进程
        ├── cli.sh           注册表、帮助、参数解析与主流程
        └── commands/        每条命令一个文件
            ├── run.sh
            ├── install.sh
            └── package.sh
```

`mvnstart run admin` 与 `mvnstart-run admin` 完全等价。加载器直接执行也行，等价于 `mvnstart`，调试某一步时方便。

安装脚本只把 `bin` 下的文件软链成命令，`lib` 不会出现在 PATH 里。

拆分按职责走，不按命令走：三条命令各自专有的代码加起来不到 90 行，剩下的是扫描、解析、勾选、启动这些三条共用的机制。bash 没有模块机制，各文件共用的是全局数组与变量，加载顺序由加载器固定，改哪个功能就看哪个文件。

### 加新命令

`lib/mvnstart/cli.sh` 顶部有一张注册表，每行五列，用竖线隔开：

```
命令名 | 说明 | 收集函数 | 目标的名词 | 是否参与编译判定
```

加一条命令要做两件事：在 `COMMANDS` 里加一行，再在 `lib/mvnstart/commands/` 下加一个文件写收集函数，函数里遍历 `POM_LIST`、对每个目标调用一次 `emit_record`。文件名随命令名，加载器按通配 source，其余文件都不用动。记录六列，顺序是：

```
标签、工作目录、-pl 的值（不走 -pl 时为空）、mvn 参数、展示用相对路径、展示用命令
```

`-pl` 的值单独占一列而不是先拼进参数字符串，是为了执行时能加引号，路径含空格时才不会被拆成两个参数。

想让新命令也有独立入口名，在 `bin` 下照抄一个入口文件即可，里面只做三件事：定位 `../lib/mvnstart-core.sh`、把命令名写进 `MVNSTART_DEFAULT_COMMAND`、`source` 之后调 `main "$@"`。入口里不写别的逻辑，默认命令必须在注册表里，写错了脚本会直接报出来。

### 实现上要注意的坑

改这个脚本之前先看这几条，都是踩过一遍的。

- **记录内部不能用制表符分列。** 制表符属于 IFS 空白，`read` 会把连续两个并成一个，空字段（不走 `-pl` 的目标）直接丢掉，后面字段整体错位，表现为工作目录被当成 mvn 参数。改用 ASCII 单元分隔符。
- **whiptail 的 checklist 结果写在 stderr 上**，不是 stdout，这一点与 dialog 相反，`man whiptail` 的 `--checklist` 一节写明了。取结果要用 `3>&1 1>&2 2>&3`。
- **函数末尾以 `[[ 条件 ]] && {...}` 收尾时，条件判假会让函数返回 1**，调用方会当成失败。回传结果的函数要显式 `return 0`。
- **记忆化必须建在主 shell 里。** `can_reach` 之类是在命令替换与进程替换的子 shell 里跑的，子 shell 里对数组的写入会随子 shell 一起丢掉，缓存等于没建。改成扫描开始时在主 shell 里统一解析、填进数组，子 shell 只读。
- **awk 遇到含 `<parent>` 的行不能整行 `next`。** pom 若把 `<parent>` 与项目自身坐标写在同一行，整行跳掉会把 `artifactId` 一起丢掉。要只摘掉行内的 parent 片段。
- **机器性能决定写法。** 在开发这台机器上，fork 一次约 10 毫秒，bash 对 14KB 文本做一次模式匹配约 1 毫秒。所以整份 pom 的文本处理全部交给 awk、一次调用取全所需信息，bash 只碰短字符串。任何「每个 pom 多跑一遍 grep」的写法都会累积成秒级开销。
- **别把入口类检查改成对整个扫描根跑一次 grep。** 从家目录或项目根扫描时，底下压着 `.vscode-server`、`node_modules` 这类大目录，实测比逐个模块查各自的源码目录还慢。
- **判定「要不要编译」时只认文件，不认目录。** 目录的 mtime 在建目录、增删文件时都会变，`find -newer` 不限定 `-type f` 的话，刚 checkout 出来的源码目录会被判成「有改动」，跳过编译永远不生效。

### 已知限制

- 多选只在当前终端里并行起，不给每个目标开独立终端窗口。
- 从 `~/`、`~/projs` 这种大范围扫描一次要几秒，是磁盘与进程派生慢，不是脚本本身的问题；在项目目录里跑通常一秒以内。
