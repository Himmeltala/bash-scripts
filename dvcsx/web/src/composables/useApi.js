// 接口封装：所有请求都走 /__dvcsx/api，出错时把后端给的那句话抛出来。

const PREFIX = '/__dvcsx/api'

export class ApiError extends Error {}

async function call(method, path, body) {
  const opts = { method, cache: 'no-store', headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
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

function q(value) {
  return encodeURIComponent(value ?? '')
}

export const api = {
  state: () => call('GET', '/state'),
  dirs: (path = '') => call('GET', `/dirs${path ? `?path=${q(path)}` : ''}`),
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  changes: (ws) => call('GET', `/changes?ws=${q(ws)}`),
  diff: (ws, path, item = '') => call('GET', `/diff?ws=${q(ws)}&path=${q(path)}&item=${q(item)}`),
  log: (ws, limit = 50) => call('GET', `/log?ws=${q(ws)}&limit=${limit}`),
  revision: (ws, rev, path = '') => call('GET', `/revision?ws=${q(ws)}&rev=${q(rev)}&path=${q(path)}`),
}
