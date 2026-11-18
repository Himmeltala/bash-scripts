# mvnx

从当前目录递归找可运行的 Spring Boot 模块或可构建的项目，勾选后执行，省去手敲 `mvn -pl <模块> spring-boot:run`。

## 用法

```
mvnx                  先选命令，再勾目标
mvnx run              显式写命令
mvnx war              找引了 jetty、tomcat、tomcat7 或 cargo 插件的 war 项目
mvnx install          列出所有可装模块，顶部「全部」一键全选
mvnx package          打包可运行模块
mvnx --no-compile     跳过编译，直接跑已有 class
mvnx --rebuild        先 clean 再编译
mvnx -c               正常编译，不加跳过参数
mvnx --list           只列目标；默认按 run 列
mvnx --refresh        清掉当前命令的勾选记录
```

四个命令：

| 命令 | 目标 | 执行 |
| --- | --- | --- |
| `run` | Spring Boot 可运行模块 | `mvn -pl <模块> spring-boot:run` |
| `war` | 引了 jetty、tomcat、tomcat7 或 cargo 插件的 war 项目 | `jetty:run`；没有 jetty 时依次取 `tomcat:run`、`tomcat7:run`、`cargo:run` |
| `install` | 顶层项目或子模块 | `mvn clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true`；按模块安装带 `-am` |
| `package` | Spring Boot 可运行模块 | `mvn -pl <模块> clean package -Dmaven.test.skip=true -am` |

`install` 带 `resources.skip`，只用于把依赖补进本地仓库，产物不适合部署。`package` 的 `--no-am` 去掉 `-am`，`--no-clean` 去掉 `clean`。

## 网页

网页入口已拆到 jvmx：`jvmx web` 统一管理 Maven 与 Gradle 工作区，mvnx 只保留终端与机器接口。

## 启动方式

不写时自动判断要不要编译；`-c`、`--no-compile`、`--rebuild` 三种模式只对 `run`、`war` 有效，`install`、`package` 带上会报用法错误。

判定只看时间戳：`src/main/java`、`src/main/kotlin`、`src/main/groovy`、`src/main/scala`、`target/generated-sources`、`mvnw`、`.mvn` 与模块各级 pom 里有文件比最新 class 新就编译；没有 `target/classes`、里面没有 class 或路径不存在，一律按需要编译处理。资源文件不参与判定。删掉源文件后旧 class 会留在 `target/classes`，需要 `--rebuild`。自动模式会打印这次为什么编译或跳过编译。

`-c` 只是不追加跳过参数，是否真正重编仍由 Maven 的编译器插件判断，它认为 class 最新时可以什么都不做；要从零编译只有 `--rebuild`。跳过编译依赖 maven-compiler-plugin 的 `maven.main.skip`，pom 里显式配置了 `skipMain` 时用户属性会被覆盖，过老的插件版本也可能不认，这是 Maven 本身的边界。`--no-compile` 要求模块里已有 class，目录为空同样按没编过拒绝。

`run` 的目标要同时满足：pom 引了 `spring-boot-maven-plugin`、不是 `pom` 打包、`src/main/java` 下有 `@SpringBootApplication`。`war` 要引 jetty（含 `jetty-ee8/9/10/11-maven-plugin`）、tomcat、tomcat7 或 cargo 插件，不是 `pom` 打包，并且存在 `src/main/webapp`，或插件配置里用 `webAppSourceDirectory`、`warSourceDirectory` 改过 web 根。

模块能被上层聚合 pom 寻址时，从最外层聚合根执行 `mvn -pl <相对路径> <目标>`；否则进模块目录执行。重名模块补上最短的唯一路径尾巴：`admin-service@shop/admin/admin-service`。

递归时跳过 `target`、`.svn`、`.git`、`node_modules`、`.idea`、`.settings`。勾选记录存在 `~/.cache/mvnx/<目录哈希>.<命令>.selected`。

## 退出码

| 码 | 含义 |
| -- | --- |
| 0 | 成功 |
| 1 | 执行失败，或没找到目标 |
| 2 | 用法错误、命令不支持某个开关、`--no-compile` 时模块没编过 |
| 3 | 用户取消 |

## 约定

- 跳过编译拿不准时一律编：多编只是慢，漏编会跑旧代码。
- 明说 `--no-compile` 但模块没有已编译的 class 时以退出码 2 拒绝。
- 只在 `--rebuild` 时 `clean`，其余动作不动 `target`。
- 勾选记录只写 `~/.cache/mvnx`；多条目标共用终端，Ctrl+C 一起退出。
