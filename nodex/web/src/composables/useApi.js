// 接口封装：所有请求都走 /__nodex/api，出错时把后端给的那句话抛出来。

const PREFIX = '/__nodex/api'

export class ApiError extends Error {}

async function call(method, path, body) {
  const opts = { method, cache: 'no-store', headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    // 只接受同源写请求，显式带上 Origin 之外的凭据没必要。
    opts.body = JSON.stringify(body)
  }
  const resp = await fetch(PREFIX + path, opts)
  let data = null
  try {
    data = await resp.json()
  } catch (err) {
    data = null
  }
  if (!resp.ok) {
    const msg = (data && data.error) || `请求失败（${resp.status}）`
    throw new ApiError(msg)
  }
  return data
}

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
}
