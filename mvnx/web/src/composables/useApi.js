// 接口封装：所有请求都走 /__mvnx/api，出错时把后端给的那句话抛出来。

import { createJsonClient } from '@bash-scripts/web-shared/http'

const PREFIX = '/__mvnx/api'
const { call } = createJsonClient({ prefix: PREFIX })

export { ApiError } from '@bash-scripts/web-shared/http'

export const api = {
  state: () => call('GET', '/state'),
  stateStreamUrl: () => `${PREFIX}/state/stream`,
  jdks: () => call('GET', '/jdks'),
  setJdk: (ws, jdk) => call('POST', '/jdk', { ws, jdk }),
  log: (run, page = 0) => call('GET', `/log?run=${encodeURIComponent(run)}&page=${page}`),
  // EventSource 不能带自定义请求头，地址直接拼出来交给它。
  logStreamUrl: (run) => `${PREFIX}/log/stream?run=${encodeURIComponent(run)}`,
  // 空路径取家目录这一层，其余取指定目录的下一层子目录。
  dirs: (path = '') => call('GET', `/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  setAlias: (ws, alias) => call('POST', '/alias', { ws, alias }),
  rescan: (ws) => call('POST', '/rescan', { ws }),
  start: (payload) => call('POST', '/start', payload),
  stop: (run) => call('POST', '/stop', { run }),
  update: (payload) => call('POST', '/update', payload),
}
