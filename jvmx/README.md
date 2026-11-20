# jvmx

一个网页同时管理 Maven 与 Gradle 工作区：登记目录后列出可启动、构建、打包、安装的目标，点按钮启停，看日志、端口与指标。

## 安装

在仓库根目录执行 `./install.sh`。运行需要 Python 3.7 以上，以及同级的 `mvnx` 与 `gradlex`；Maven 工程需要 `pom.xml` 或 `mvnw`，Gradle 工程需要 `settings.gradle(.kts)` 或 `gradlew`。

工程发现与执行交给 `mvnx` / `gradlex`，jvmx 只做网页壳。

## 用法

```bash
jvmx            # 等价于 jvmx web
jvmx web
```

默认监听 `0.0.0.0:8300`，同一网络里的机器能直接打开；只想本机用就加 `--host 127.0.0.1`。

| 选项 | 说明 |
| --- | --- |
| `--host 地址` | 监听地址，默认 `0.0.0.0` |
| `-p, --port 端口` | 监听端口，默认 8300 |
| `-o, --open` | 起来后打开默认浏览器 |
| `--json` | 只打一行地址给脚本起服务用 |
| `--allow-write` | 允许其他机器发起写操作；默认写操作与 JDK、目录读取只认本机 |

## 开发

```bash
npm --prefix jvmx/web ci
npm --prefix jvmx/web run build
python3 jvmx/test/test_web_state.py
```
