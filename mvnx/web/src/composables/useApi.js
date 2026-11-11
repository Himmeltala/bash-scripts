// 接口封装：所有请求都走 /__mvnx/api，出错时把后端给的那句话抛出来。

const PREFIX = '/__mvnx/api'

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
  log: (run, page = 0) => call('GET', `/log?run=${encodeURIComponent(run)}&page=${page}`),
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  rescan: (ws) => call('POST', '/rescan', { ws }),
  start: (payload) => call('POST', '/start', payload),
  stop: (run) => call('POST', '/stop', { run }),
  update: (svc, module, args) => call('POST', '/update', { svc, module, args }),
}
