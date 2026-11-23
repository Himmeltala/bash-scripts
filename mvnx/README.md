# mvnx

从当前目录递归找可运行的 Spring Boot 模块或可构建的项目，勾选后执行。网页入口见 `idex` 的 JVM 页签。

## 安装

在仓库根目录执行 `./install.sh`。需要 Maven 或工程自带的 `./mvnw`。

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

| 命令 | 目标 | 执行 |
| --- | --- | --- |
| `run` | Spring Boot 可运行模块 | `mvn -pl <模块> spring-boot:run` |
| `war` | 引了 jetty、tomcat、tomcat7 或 cargo 插件的 war 项目 | `jetty:run`；没有 jetty 时依次取 `tomcat:run`、`tomcat7:run`、`cargo:run` |
| `install` | 顶层项目或子模块 | `mvn clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true`；按模块安装带 `-am` |
| `package` | Spring Boot 可运行模块 | `mvn -pl <模块> clean package -Dmaven.test.skip=true -am` |

`install` 只把依赖补进本地仓库，产物不适合部署。`package` 的 `--no-am` 去掉 `-am`，`--no-clean` 去掉 `clean`。

## 启动方式

不写时自动判断要不要编译；`-c`、`--no-compile`、`--rebuild` 只对 `run`、`war` 有效。源文件比最新 class 新就编译；没有 `target/classes` 或里面没有 class 也按需要编译处理。删掉源文件后旧 class 会留着，需要 `--rebuild`。

`--deps` 只在 `run`、`war` 上有效，且不能与 `--no-compile` 同用。启动前先看兄弟模块的源码有没有比已编译的 class 新，有就 `mvn -pl <模块> -am install` 补进本地仓库。idex 的 JVM 页签里启动按钮默认带它。

`run` 的目标要同时满足：pom 引了 `spring-boot-maven-plugin`、不是 `pom` 打包、`src/main/java` 下有 `@SpringBootApplication`。`war` 要引 jetty、tomcat、tomcat7 或 cargo 插件，并且存在 `src/main/webapp`。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 执行失败，或没找到目标 |
| 2 | 用法错误、命令不支持某个开关、`--no-compile` 时模块没编过 |
| 3 | 用户取消 |
