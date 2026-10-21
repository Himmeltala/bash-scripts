# mvnx

省去手敲 `mvn -pl <模块> spring-boot:run` 这类长命令。从当前目录递归找出可运行的模块或可构建的项目，勾选后执行。

## 用法

```
mvnx                 先选命令，再勾目标
mvnx run             同上，显式写命令名
mvnx war             找引了 jetty 或 tomcat 插件的 war 项目，勾选后启动
mvnx install         直接列出所有项目的可装模块，顶部「全部」一键全选
mvnx install --no-am 按模块安装时不带 -am，兄弟模块须已在本地仓库
mvnx package         找可运行模块，勾选后打成可部署的 jar
mvnx package --no-am  打包时不构建依赖的兄弟模块
mvnx admin           带关键词时跳过界面，按子串匹配标签或路径后直接执行
mvnx install 人影    先写命令名，再写关键词
mvnx admin -c        强制编译后启动
mvnx --no-compile    跳过编译，直接跑已有的 class
mvnx --rebuild       先 clean 再编译后启动
mvnx --list          只列出目标，不执行；没写命令时按 run 列
mvnx --refresh       清掉当前命令上次的勾选记录，重新开始
mvnx --help          显示帮助，命令清单从注册表生成
```

不带参数时打开主菜单：先选命令（启动、启动 war、装本地仓库、打包、退出），再进目标勾选；一个命令执行完回到菜单，只有选退出才离开。给了命令名或关键词时跳过菜单直接执行。

界面用方向键移动，用空格勾选，用回车确认；按 `←` 或 `b` 返回上一步，按 `q` 取消。上次勾过的目标下次自动预勾选。从主菜单进入时，返回后回到命令选择；直接写命令时没有上一步，返回等同于取消。

勾选一个目标时，脚本用 `exec` 把自身进程整个换成 `mvn`，输出、颜色与 Ctrl+C 行为都和手敲完全一样。勾选多个时全部后台执行，输出仍然直接打在当前终端上，脚本只在最后等待。按一次 Ctrl+C，信号送到整个前台进程组，所有任务一起退出。

非交互环境（管道、脚本、CI）下探不到终端，自动退回编号输入，避免界面卡住。

## 界面

界面全部自绘，不依赖 whiptail。每屏固定为标题、键位提示、分隔线、清单、分隔线和底部状态栏。清单行由强调色竖条、勾选标记、主文本与灰色次要路径组成；光标行的竖条加粗，已勾标记为绿色，「全部」行使用普通勾选标记。底部状态栏左侧显示已选数量与滚动提示，右侧显示取消键。

颜色用 256 色，遵循 `NO_COLOR`，`TERM=dumb` 时不着色。宽字符按两列计算，中文不会把边线撑破。

组件来自独立仓库 `Himmeltala/bash-tui`，由仓库根下的 `lib/tui-path.sh` 定位并加载，`mvnx` 与 `zipx` 共用；`ui.sh` 只负责组装屏幕。以后别的命令要新界面，直接用这些组件：

| 组件 | 作用 |
| --- | --- |
| `tui_theme`、`tui_begin`、`tui_end` | 主题初始化，进出备用屏与光标 |
| `tui_size`、`tui_clear` | 取终端尺寸，清屏 |
| `tui_title`、`tui_subtitle` | 标题行、说明行 |
| `tui_hint` | 键位提示，按键与说明成对传入 |
| `tui_rule` | 分隔线 |
| `tui_row` | 清单行，接受光标、勾选标记、主文本、次要文本 |
| `tui_status` | 底部状态栏，左右两段自动留白 |
| `tui_select` | 单选、复选与带「全部」的复选 |
| `tui_input`、`tui_confirm` | 单行输入、是或否确认 |
| `tui_textbox` | 分页查看文件内容 |
| `_tui_measure`、`_tui_clip_to` | 按显示宽度计算与截断，结果写进 `_TUI_WIDTH`、`_TUI_TEXT` |

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 找到了目标但执行失败，或者当前目录下没找到目标 |
| 2 | 用法错误：未知选项、命令不支持某个开关、`--no-compile` 时模块没编过 |
| 3 | 用户取消：在菜单或勾选界面里取消，或者确认时一个都没勾 |

## 安全约定

- **跳过编译的判定拿不准一律判「需要编译」**（没有 `target/classes`、里面一个 class 都没有、路径不存在都算拿不准）。多编一次只是慢，漏编一次就是跑到旧代码。
- **明说 `--no-compile` 但模块没编过时直接拒绝**，退 2，不硬起一个空壳进程。
- **只在 `--rebuild` 时 `clean`**，其余动作不动 `target`，也不碰工作副本里的源码。
- **勾选记录只写缓存目录**（`~/.cache/mvnx`），`--refresh` 只清当前目录当前命令这一份。
- **多条目标后台执行时共用当前终端**，按一次 Ctrl+C 送到整个前台进程组，所有任务一起退出；脚本自身只收等待，不拦截信号。

## 启动方式

默认会自动判断这一条记录要不要编译，另外三种方式由命令行指定。模式参数只对 `run` 与 `war` 有效；`install` 与 `package` 收到 `--no-compile` 或 `--rebuild` 会直接报用法错误退出，因为装本地仓库与打包都必须真编译。命令行中后写的参数覆盖先写的。

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

## 四条命令

| 命令 | 目标 | 执行的 Maven 命令 |
| --- | --- | --- |
| `run` | 可运行的 Spring Boot 模块 | `mvn -pl <模块路径> spring-boot:run`，尾部参数受启动方式影响 |
| `war` | 引了 jetty 或 tomcat 插件的 war 项目 | `mvn -pl <模块路径> jetty:run`，只声明 tomcat 插件时换成 `tomcat:run` |
| `install` | 顶层项目，或项目下的子模块 | `mvn clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true`；按模块安装时从项目根执行 `mvn -pl <模块路径> ... -am` |
| `package` | 可运行的 Spring Boot 模块 | `mvn -pl <模块路径> clean package -Dmaven.test.skip=true -am` |

`install` 带 `maven.resources.skip`，装出来的 jar 里没有 `application.yml` 这类资源，用途是快速把依赖补齐进本地仓库，让 `run` 能解析到兄弟模块，不适合拿去部署。

`install` 选完命令后直接进模块清单，把当前目录下所有顶层项目的子模块合成一张，可多选。清单顶部是「全部」总开关：勾上它会把下面所有模块一起勾上，取消任意一个模块时它自动取消，下面全部勾上时它自动勾上。模块清单只列非 `pom` 打包的子模块，pom 打包的父模块不单独出现，需要时由 `-am` 顺带构建。项目没有子模块时，清单里放该项目本身，仍可按整个项目安装。

`package` 打的是能拿去部署的 jar，参数有两个开关：

| 开关 | 行为 |
| --- | --- |
| 不写 | `clean package -Dmaven.test.skip=true -am` |
| `--no-am` | 去掉 `-am`，兄弟模块必须已经装进本地仓库，省下拉起它们的时间 |
| `--no-clean` | 去掉 `clean`，增量打包最快，代价是残留的旧 class 会进 jar |

`-am` 让 Maven 连这个模块依赖的兄弟模块一起构建，兄弟模块还没装进本地仓库时也能一次打包成功。跳过测试省下的是编译测试类与跑测试的时间，打出来的是能跑的东西，不是验证过的版本。`--no-am` 对 `package` 与 `install` 按模块安装都有效，`--no-clean` 只对 `package` 有效，别的命令带上直接报用法错误退出。

## 目标的判定

`run` 三条同时满足：自己的 pom 里引了 `spring-boot-maven-plugin`、打包方式不是 `pom`、`src/main/java` 下确实存在带 `@SpringBootApplication` 的类。父 pom 与 common 这类纯依赖模块会被滤掉。

`war` 三条同时满足：自己的 pom 里引了 `jetty-maven-plugin` 或 `tomcat-maven-plugin`（org.codehaus.mojo）、打包方式不是 `pom`、模块目录下存在 `src/main/webapp`。两个插件都声明时启动目标取 `jetty:run`，只声明 tomcat 时取 `tomcat:run`。

`package` 与 `run` 是同一批目标。三个收集函数共用同一遍遍历（`each_module`），各自只提供一个判定谓词，聚合根寻址与标签去重都不重写。`install` 用的是自己的判定，不走这一遍。

`install` 判定顶层项目：没有被任何上层聚合 pom 的 `<modules>` 收录的 pom。按模块安装时，从选中项目的根目录沿 `<modules>` 递归往下收集非 `pom` 打包的子模块，标签带项目前缀，不同项目里的同名模块不会混在一起。

递归时跳过 `target`、`.svn`、`.git`、`node_modules`、`.idea`、`.settings`。

## 启动命令怎么拼

模块能被某个上层聚合 pom 声明走到时，从该聚合根目录执行 `mvn -pl <相对路径> <目标>`；走不到时进入模块目录执行 `mvn <目标>`。目标是 `spring-boot:run`、`jetty:run` 还是 `tomcat:run`，由该模块自己的判定决定。

聚合根取的是**最外层**那个能走到模块的 pom。以 `runnet-admin-service` 为例，它既能由 `runnet-admin` 寻址，也能由 `backend` 寻址，脚本选 `backend`，拼出来是：

```
cd .../runnet-national-figures-v2.0/backend
mvn -pl runnet-admin/runnet-admin-service spring-boot:run
```

与手工在项目根目录下敲的形式一致。Maven 的 `-pl` 接受指向嵌套模块的路径，即便该模块没有被根 pom 直接声明。

`package` 与 `war` 拼路径的方式与 `run` 相同，只是把 `spring-boot:run` 换成打包参数或 war 的启动目标。

## 同名目标

大范围扫描时，不同项目里会同时存在 `runnet-admin-service` 这类同名模块。脚本给重名的补上最短的唯一路径尾巴，段数按同名分组统一取：

```
runnet-admin-service@back-end/runnet-admin/runnet-admin-service
runnet-admin-service@backend/runnet-admin/runnet-admin-service
```

## 勾选记录

存在 `~/.cache/mvnx/<当前目录的哈希>.<命令名>.selected`，按「所在目录加命令」分开记，`run` 的勾选不会串到 `install` 上。`--refresh` 只清当前目录当前命令这一份。

## 文件结构

```
mvnx/
├── README.md
├── bin/
│   └── mvnx             唯一入口：定位核心、转发参数
└── lib/
    ├── mvnx-core.sh     加载器，按顺序 source 下面各文件
    └── mvnx/
        ├── util.sh          退出码、报错、终端探测、记录分列、路径计算
        ├── pom.sh           pom 扫描与解析、可运行模块判定、聚合根寻址
        ├── ui.sh            界面组装：菜单与复选、勾选记录、同名标签去重
        ├── exec.sh          启动方式与编译判定、起进程
        ├── cli.sh           注册表、帮助、参数解析、动作分发与主菜单
        └── commands/        每条命令一个文件
            ├── run.sh
            ├── war.sh
            ├── install.sh
            └── package.sh
```

界面组件在独立仓库 `bash-tui`，由仓库根下的 `lib/tui-path.sh` 定位，不在上面的目录树里。加载器直接执行也行，等价于 `mvnx`，调试某一步时方便。

安装脚本只把 `bin` 下的文件软链成命令，`lib` 不会出现在 PATH 里。

拆分按职责走，不按命令走：四条命令各自专有的代码加起来不到 90 行，剩下的是扫描、解析、勾选、启动这些共用机制。bash 没有模块机制，各文件共用的是全局数组与变量，加载顺序由加载器固定，改哪个功能就看哪个文件。

## 加新命令

`lib/mvnx/cli.sh` 顶部有一张注册表，每行六列，用竖线隔开：

```
命令名 | 说明 | 收集函数 | 目标的名词 | 是否参与编译判定 | 选择函数
```

最后一列留空时使用统一的目标复选。需要自定义勾选流程的命令填自己的选择函数名，由它接管勾选，把最终要执行的记录输出到 stdout，并自己调用 `save_selection` 写勾选记录（`install` 就是这么做的）。

加一条命令要做两件事：在 `COMMANDS` 里加一行，再在 `lib/mvnx/commands/` 下加一个文件写收集函数，函数里遍历 `POM_LIST`、对每个目标调用一次 `emit_record`。文件名随命令名，加载器按通配 source，主菜单也从注册表生成，其余文件都不用动。记录六列，顺序是：

```
标签、工作目录、-pl 的值（不走 -pl 时为空）、mvn 参数、展示用相对路径、展示用命令
```

`-pl` 的值单独占一列而不是先拼进参数字符串，是为了执行时能加引号，路径含空格时才不会被拆成两个参数。

新命令不用加入口文件：`mvnx <命令名>` 就能用，不带参数时的主菜单也会自动多出这一项，两处都从注册表生成。

## 实现上要注意的坑

改这个脚本之前先看这几条，都是踩过一遍的。

- **记录内部不能用制表符分列。** 制表符属于 IFS 空白，`read` 会把连续两个并成一个，空字段（不走 `-pl` 的目标）直接丢掉，后面字段整体错位，表现为工作目录被当成 mvn 参数。改用 ASCII 单元分隔符。
- **自绘界面只能写 stderr。** 选择函数按 `out=$(ui_select ...)` 调用，stdout 被命令替换拿走存结果，界面画到 stdout 就会被当成勾选结果。进出备用屏与恢复光标要挂在 `EXIT`、`INT` trap 上，否则 Ctrl+C 之后终端会留在备用屏里。
- **函数末尾以 `[[ 条件 ]] && {...}` 收尾时，条件判假会让函数返回 1**，调用方会当成失败。回传结果的函数要显式 `return 0`。
- **记忆化必须建在主 shell 里。** `can_reach` 之类是在命令替换与进程替换的子 shell 里跑的，子 shell 里对数组的写入会随子 shell 一起丢掉，缓存等于没建。改成扫描开始时在主 shell 里统一解析、填进数组，子 shell 只读。
- **awk 遇到含 `<parent>` 的行不能整行 `next`。** pom 若把 `<parent>` 与项目自身坐标写在同一行，整行跳掉会把 `artifactId` 一起丢掉。要只摘掉行内的 parent 片段。
- **机器性能决定写法。** 在开发这台机器上，fork 一次约 10 毫秒，bash 对 14 KB 文本做一次模式匹配约 1 毫秒。所以整份 pom 的文本处理全部交给 awk、一次调用取全所需信息，bash 只碰短字符串。任何「每个 pom 多跑一遍 grep」的写法都会累积成秒级开销。
- **别把入口类检查改成对整个扫描根跑一次 grep。** 从家目录或项目根扫描时，底下压着 `.vscode-server`、`node_modules` 这类大目录，实测比逐个模块查各自的源码目录还慢。
- **判定「要不要编译」时只认文件，不认目录。** 目录的 mtime 在建目录、增删文件时都会变，`find -newer` 不限定 `-type f` 的话，刚 checkout 出来的源码目录会被判成「有改动」，跳过编译永远不生效。

## 已知限制

- 多选只在当前终端里并行起，不给每个目标开独立终端窗口。
- 从 `~/`、`~/projs` 这种大范围扫描一次要几秒，原因是磁盘与进程派生较慢，不是脚本本身的问题；在项目目录里执行通常在 1 秒以内。
- `war` 只认 `jetty-maven-plugin` 与 `tomcat-maven-plugin` 两个插件，`tomcat7-maven-plugin`、`tomcat6-maven-plugin` 这类不认，用它们的项目列不出来，只能手工执行 `mvn tomcat7:run`。
- `war` 的 `--no-compile` 靠 `-Dmaven.main.skip=true` 生效，在 `jetty:run` 上可用；`tomcat-maven-plugin` 是否同样吃这个参数没有实测，不吃也只是照样编译一遍，不会跑到旧代码。
