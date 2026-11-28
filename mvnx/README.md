# mvnx

递归查找可运行的 Spring Boot 模块或可构建的项目，勾选后执行。

## 安装

仓库根目录执行 `./install.sh`。需要 Maven 或工程自带的 `./mvnw`。

## 用法

```
mvnx                  先选命令，再勾目标
mvnx run|war|install|package
mvnx --no-compile     跳过编译，直接跑已有 class
mvnx --rebuild        先 clean 再编译
mvnx -c               正常编译，不加跳过参数
mvnx --list           只列目标（默认按 run 列）
mvnx --refresh        清掉当前命令的勾选
```
