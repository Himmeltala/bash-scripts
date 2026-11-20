# idex 网页前端

源码在 `src/`，Vite 打包到 `../lib/idex/web/static`。

## 打包

```bash
cd idex/web
npm install
npm run build
```

需要 Node 20.19 或 22.12 以上。`idex web` 跑的是 `static/` 里的产物。

## 开发

先固定后端端口：

```bash
idex web --host 127.0.0.1 -p 8771
```

再起 Vite，接口代理到 8771：

```bash
cd idex/web
IDEX_WEB_ORIGIN=http://127.0.0.1:8771 npm run dev
```
