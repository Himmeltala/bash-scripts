// 工作区类工具的公共接口表：状态、目录、登记、别名、分组、启停这些路由各工具一致。
// extra 里的同名键覆盖公共项，工具自己的端点也从这里补。

import { createJsonClient, encodeParam } from '../commons/http.js'

export function createToolApi(prefix, extra = {}) {
  const { call } = createJsonClient({ prefix })
  const api = {
    state: () => call('GET', '/state'),
    stateStreamUrl: () => `${prefix}/state/stream`,
    log: (run, page = 0) => call('GET', `/log?run=${encodeParam(run)}&page=${page}`),
    // EventSource 不能带自定义请求头，地址直接拼出来交给它。
    logStreamUrl: (run) => `${prefix}/log/stream?run=${encodeParam(run)}`,
    // 空路径取家目录这一层，其余取指定目录的下一层子目录。
    dirs: (path = '') => call('GET', `/dirs${path ? `?path=${encodeParam(path)}` : ''}`),
    addWorkspace: (root) => call('POST', '/workspaces', { root }),
    forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
    setAlias: (ws, alias) => call('POST', '/alias', { ws, alias }),
    saveGroups: (nodes) => call('POST', '/groups', { nodes }),
    rescan: (ws) => call('POST', '/rescan', { ws }),
    start: (payload) => call('POST', '/start', payload),
    stop: (run) => call('POST', '/stop', { run }),
    update: (payload) => call('POST', '/update', payload),
  }
  return { call, api: { ...api, ...extra } }
}
