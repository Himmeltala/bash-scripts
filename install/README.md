# install

`install.sh` 的实现目录。入口只做参数解析与流程编排，其余按职责拆到 `lib/`。

```
lib/common.sh     目录复制、下载临时目录清理
lib/bash-tui.sh   定位、下载、安装 bash-tui
lib/web.sh        前端依赖安装与构建
lib/layout.sh     源码复制、旧版本清理、软链与 PATH
lib/deps.sh       可选依赖的列表、校验与调用
deps/<名字>.sh    可选依赖，由 `./install.sh --deps <名字>` 调用
```

`install.sh` 先确定源码位置，再从源码的 `install/lib/` 加载模块；管道安装时同样先下载归档。

```bash
./install.sh --list-deps
./install.sh --deps libreoffice
./install.sh --deps libreoffice,other
./install.sh --deps all
```

## 新增一个依赖

在 `install/deps/` 放 `<名字>.sh`，约定：

- 第一行写 `# deps: 一句话说明`，`--list-deps` 会显示。
- 幂等：已安装时打印说明并退出 0。
- 需要 root 时自己用 `sudo`，不要假设脚本以 root 运行。
- 失败以非 0 退出；`install.sh` 会中止并报错。
- 名字用 `[a-z0-9_-]`，与文件名一致。

脚本通过 `bash <脚本>` 执行，不依赖可执行位。
