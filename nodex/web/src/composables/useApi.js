// 接口封装：所有请求都走 /__nodex/api，出错时把后端给的那句话抛出来。

import { createJsonClient } from '@bash-scripts/web-shared/http'

const PREFIX = '/__nodex/api'
const { call } = createJsonClient({ prefix: PREFIX })

export { ApiError } from '@bash-scripts/web-shared/http'

export const api = {
  state: () => call('GET', '/state'),
  stateStreamUrl: () => `${PREFIX}/state/stream`,
  nodes: () => call('GET', '/nodes'),
  setNode: (ws, node) => call('POST', '/node', { ws, node }),
  log: (run, page = 0) => call('GET', `/log?run=${encodeURIComponent(run)}&page=${page}`),
  // EventSource 不能带自定义请求头，地址直接拼出来交给它。
  logStreamUrl: (run) => `${PREFIX}/log/stream?run=${encodeURIComponent(run)}`,
  // 空路径取家目录这一层，其余取指定目录的下一层子目录。
  dirs: (path = '') => call('GET', `/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  // CPU、内存、磁盘的当前值，取一次算一个点。
  metrics: () => call('GET', '/metrics'),
  metricsStreamUrl: () => `${PREFIX}/metrics/stream`,
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  setAlias: (ws, alias) => call('POST', '/alias', { ws, alias }),
  rescan: (ws) => call('POST', '/rescan', { ws }),
  start: (payload) => call('POST', '/start', payload),
  stop: (run) => call('POST', '/stop', { run }),
  update: (svc, args) => call('POST', '/update', { svc, args }),
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
