// 接口封装：公共端点走共享表，Node 专属的在这里补。

import { createToolApi } from '@bash-scripts/web-shared'

const PREFIX = '/__nodex/api'
const { call, api: base } = createToolApi(PREFIX)

export { ApiError } from '@bash-scripts/web-shared/http'

export const api = {
  ...base,
  nodes: () => call('GET', '/nodes'),
  setNode: (ws, node) => call('POST', '/node', { ws, node }),
  addCommand: (payload) => call('POST', '/addcmd', payload),
  removeCommand: (svc) => call('POST', '/delcmd', { svc }),
  // 压缩栏：列工作区里一层的内容、起打包、问这次打包跑完没有。
  entries: (ws, rel = '') => call('GET', `/entries?ws=${encodeURIComponent(ws)}&rel=${encodeURIComponent(rel)}`),
  zip: (payload) => call('POST', '/zip', payload),
  zipStatus: (run) => call('GET', `/zip?run=${encodeURIComponent(run)}`),
  // 打好的包直接交给浏览器下，链接带下载头，点一下就是另存为。
  downloadUrl: (ws, name) =>
    `${PREFIX}/download?ws=${encodeURIComponent(ws)}&name=${encodeURIComponent(name)}`,
  // 右键下载树里的某个条目；目录由后端现场压成 zip。
  entryUrl: (ws, rel) =>
    `${PREFIX}/entry?ws=${encodeURIComponent(ws)}&path=${encodeURIComponent(rel || '')}`,
}
