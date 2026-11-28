# mvnx

递归查找可运行的 Spring Boot 模块或可构建的项目，勾选后执行。网页入口在 `idex` 的 JVM 页签。

## 安装

仓库根目录执行 `./install.sh`。需要 Maven 或工程自带的 `./mvnw`。

## 用法

```
mvnx                  先选命令，再勾目标
mvnx run              显式写命令
mvnx war              找引了 jetty、tomcat、tomcat7 或 cargo 插件的 war 项目
mvnx install          列出所有可装模块，顶部「全部」全选
mvnx package          打包可运行模块
mvnx --no-compile     跳过编译，直接跑已有 class
mvnx --rebuild        先 clean 再编译
mvnx -c               正常编译，不加跳过参数
mvnx --list           只列目标（默认按 run 列）
mvnx --refresh        清掉当前命令的勾选
```

| 命令 | 目标 | 执行 |
| --- | --- | --- |
| `run` | Spring Boot 可运行模块 | `mvn -pl <模块> spring-boot:run` |
| `war` | 引了 jetty、tomcat、tomcat7 或 cargo 插件的 war 项目 | `jetty:run`；没有 jetty 时依次取 `tomcat:run`、`tomcat7:run`、`cargo:run` |
| `install` | 顶层项目或子模块 | `mvn clean install -Dmaven.test.skip=true -U -e -Dmaven.resources.skip=true`；按模块安装带 `-am` |
| `package` | Spring Boot 可运行模块 | `mvn -pl <模块> clean package -Dmaven.test.skip=true -am` |

`install` 只补本地仓库依赖，产物不适合部署。`package` 的 `--no-am` 去掉 `-am`，`--no-clean` 去掉 `clean`。

## 编译开关

- 不写开关时自动判断：没有 `target/classes`、里面没有 class，或源文件比 class 新，就先编译。
- `-c`、`--no-compile`、`--rebuild` 只对 `run`、`war` 有效。删掉源文件后旧 class 会留着，需要 `--rebuild`。
- `--deps` 只对 `run`、`war` 有效，不能与 `--no-compile` 同用；启动前若兄弟模块源码比 class 新，先 `mvn -pl <模块> -am install`。

目标判定：

- `run`：pom 引了 `spring-boot-maven-plugin`、不是 `pom` 打包、`src/main/java` 下有 `@SpringBootApplication`。
- `war`：引了 jetty、tomcat、tomcat7 或 cargo 插件，且存在 `src/main/webapp`。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 执行失败，或没找到目标 |
| 2 | 用法错误、命令不支持某个开关、`--no-compile` 时模块没编过 |
| 3 | 用户取消 |
