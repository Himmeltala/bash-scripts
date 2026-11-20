# nodex 网页前端

源码在 `src/`，Vite 打包到 `../lib/nodex/web/static`。

## 打包

```bash
cd nodex/web
npm install
npm run build
```

需要 Node 20.19 或 22.12 以上。`nodex web` 跑的是 `static/` 里的产物。

## 开发

先固定后端端口：

```bash
nodex web --host 127.0.0.1 -p 8770
```

再起 Vite，接口代理到 8770：

```bash
cd nodex/web
NODEX_WEB_ORIGIN=http://127.0.0.1:8770 npm run dev
```
