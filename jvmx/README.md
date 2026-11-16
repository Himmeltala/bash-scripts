# jvmx

一个网页同时管 Maven 与 Gradle 工作区：登记目录后列出可启动、构建、打包、安装的目标，点按钮启停，看日志、端口与指标。

jvmx 只做网页壳。工程目标由 `mvnx` / `gradlex` 的机器接口算出来，执行也交给它们的 `exec`，所以 pom、`settings.gradle`、`-pl` 聚合与 Spring Boot 插件判定这些规则不会在两边各写一份。

## 启动

```bash
jvmx            # 等价于 jvmx web
jvmx web
```

默认监听 `0.0.0.0:8300`，同一网络里的机器能直接打开；只想本机用就加 `--host 127.0.0.1`。

| 选项 | 说明 |
| --- | --- |
| `--host 地址` | 监听地址，默认 `0.0.0.0` |
| `-p, --port 端口` | 监听端口，默认 `8300` |
| `-o, --open` | 起来后打开默认浏览器 |
| `--json` | 只打一行 `{"url":…,"local":…,"host":…,"port":…}`，给脚本起服务用 |
| `--allow-write` | 允许其他机器发起写操作；默认写操作与 JDK、目录读取只认本机 |

不带参数直接起网页，是因为 jvmx 没有终端业务：终端里的目标发现与执行分别是 `mvnx` 与 `gradlex`。

## 依赖

- `bash` 与 `python3.7` 以上，只用标准库；共享代码在仓库根的 `lib/py-shared`。
- 与 jvmx 同级的 `mvnx`、`gradlex` 入口（安装目录里天然如此）。
- Maven 工程需要 `pom.xml` 或 `mvnw`；Gradle 工程需要 `settings.gradle`、`settings.gradle.kts` 或 `gradlew`。真正执行时仍要 PATH 里有 `mvn` / `gradle`，或工程自带 wrapper。
- 前端构建需要 `node` 与 `npm`。

## 与 mvnx / gradlex 的关系

jvmx 不解析工程文件，只调用：

```bash
mvnx --list --json run|war|install|package
mvnx exec --id <id> [--mode auto|compile|no-compile|rebuild] [--args "参数"]

gradlex --list --json run|build
gradlex exec --id <id> [--rebuild] [--refresh] [--args "参数"]
```

工作区根目录通过子进程的当前目录传入，不加 `--root`。终端里直接跑 `mvnx` / `gradlex` 的行为不变。

## 数据与构建

- 工作区、别名、分组与每行参数：`~/.cache/jvmx/web/state.json`
- 运行记录：`~/.cache/jvmx/web/runs.json`
- 日志：`~/.cache/jvmx/web/logs/<工作区>/<运行号>.log`

接口前缀是 `/__jvmx/api`，沿用旧 mvnx 网页的接口形状，前端沿用共享的 `WorkspaceShell`、`ServiceTable`、`SettingsDialog` 与 `Metrics`。

```bash
npm --prefix jvmx/web ci
npm --prefix jvmx/web run build     # 产物进 jvmx/lib/jvmx/web/static
python3 jvmx/test/test_web_state.py # 用假的 mvn / gradle 跑接口回归
```
