# dvcsx 网页前端

源码在 `src/`，由 Vite 打包到 `../lib/dvcsx/web/static`。产物跟源码一起进仓库，平时用网页不需要本机装 Node。

## 打包

```bash
cd dvcsx/web
npm install
npm run build
```

Vite 8 要求 Node 20.19 或 22.12 以上。装依赖与打包只在这一步做；`dvcsx web` 跑的是 `static/` 里的产物。

## 开发

先起后端（固定端口方便代理）：

```bash
dvcsx web --host 127.0.0.1 -p 8771
```

再起 Vite，接口请求由它代理到 8771：

```bash
cd dvcsx/web
DVCSX_WEB_ORIGIN=http://127.0.0.1:8771 npm run dev
```
