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

// SSE 不能走 fetch，地址单独给页面拼。
export function stateEventsUrl() {
  return `${PREFIX}/state/stream`
}

export function workspaceEventsUrl(ws) {
  return `${PREFIX}/events?ws=${q(ws)}`
}

export function jobEventsUrl(id) {
  return `${PREFIX}/operations/${q(id)}/events`
}

export const api = {
  state: () => call('GET', '/state'),
  dirs: (path = '') => call('GET', `/dirs${path ? `?path=${q(path)}` : ''}`),
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  setAlias: (ws, alias) => call('POST', '/alias', { ws, alias }),
  changes: (ws) => call('GET', `/changes?ws=${q(ws)}`),
  diff: (ws, path, item = '', full = false) =>
    call('GET', `/diff?ws=${q(ws)}&path=${q(path)}&item=${q(item)}&full=${full ? 1 : 0}`),
  log: (ws, limit = 50, skip = 0, sync = true) =>
    call('GET', `/log?ws=${q(ws)}&limit=${limit}&skip=${skip}&sync=${sync ? 1 : 0}`),
  commit: (ws, rev) => call('GET', `/commit?ws=${q(ws)}&rev=${q(rev)}`),
  revision: (ws, rev, path = '', full = false) =>
    call(
      'GET',
      `/revision?ws=${q(ws)}&rev=${q(rev)}&path=${q(path)}&full=${full ? 1 : 0}`
    ),
  syncInfo: (ws) => call('GET', `/sync-info?ws=${q(ws)}`),
  startOperation: (body) => call('POST', '/operations', body),
  latestOperation: (ws) => call('GET', `/operations?ws=${q(ws)}`),
  job: (id) => call('GET', `/operations/${q(id)}`),
  cancelOperation: (id) => call('POST', `/operations/${q(id)}/cancel`, {}),
  tree: (ws, path = '') => call('GET', `/tree?ws=${q(ws)}&path=${q(path)}`),
  file: (ws, path) => call('GET', `/file?ws=${q(ws)}&path=${q(path)}`),
  save: (ws, path, text) => call('POST', '/save', { ws, path, text }),
  search: (ws, text, mode = 'name', path = '') =>
    call(
      'GET',
      `/search?ws=${q(ws)}&q=${q(text)}&mode=${q(mode)}&path=${q(path)}`
    ),
}
