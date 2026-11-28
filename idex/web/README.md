# idex 网页前端

源码在 `src/`，Vite 打包到 `dist/`；`idex web` 跑的是 `dist/` 里的产物。

## 打包

```bash
cd idex/web
npm install
npm run build
```

需要 Node 20.19 或 22.12 以上。

## 开发

仓库根目录：

```bash
./dev.sh idex
```

或手动起后端与 Vite：

```bash
idex web --host 127.0.0.1 -p 8771

cd idex/web
IDEX_WEB_ORIGIN=http://127.0.0.1:8771 npm run dev
```
