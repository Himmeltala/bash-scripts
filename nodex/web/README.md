# nodex 网页前端

源码在 `src/`，由 Vite 打包到 `../lib/nodex/web/static`。产物跟源码一起进仓库，平时用网页不需要本机装 Node。

## 打包

```bash
cd nodex/web
npm install
npm run build
```

Vite 8 要求 Node 20.19 或 22.12 以上。装依赖与打包只在这一步做；`nodex web` 跑的是 `static/` 里的产物。

## 开发

先起后端（固定端口方便代理）：

```bash
nodex web --host 127.0.0.1 -p 8770
```

再起 Vite，接口请求由它代理到 8770：

```bash
cd nodex/web
NODEX_WEB_ORIGIN=http://127.0.0.1:8770 npm run dev
```
