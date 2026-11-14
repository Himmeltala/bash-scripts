// 接口封装：所有请求都走 /__dvcsx/api，出错时把后端给的那句话抛出来。

import { createJsonClient, encodeParam } from '@bash-scripts/web-shared/http'

const PREFIX = '/__dvcsx/api'
const { call } = createJsonClient({ prefix: PREFIX })

export { ApiError } from '@bash-scripts/web-shared/http'

// SSE 不能走 fetch，地址单独给页面拼。
export function stateEventsUrl() {
  return `${PREFIX}/state/stream`
}

export function workspaceEventsUrl(ws) {
  return `${PREFIX}/events?ws=${encodeParam(ws)}`
}

export function jobEventsUrl(id) {
  return `${PREFIX}/operations/${encodeParam(id)}/events`
}

export const api = {
  state: () => call('GET', '/state'),
  dirs: (path = '') => call('GET', `/dirs${path ? `?path=${encodeParam(path)}` : ''}`),
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  setAlias: (ws, alias) => call('POST', '/alias', { ws, alias }),
  changes: (ws) => call('GET', `/changes?ws=${encodeParam(ws)}`),
  diff: (ws, path, item = '', full = false) =>
    call('GET', `/diff?ws=${encodeParam(ws)}&path=${encodeParam(path)}&item=${encodeParam(item)}&full=${full ? 1 : 0}`),
  log: (ws, limit = 50, skip = 0, sync = true, allRefs = true) =>
    call(
      'GET',
      `/log?ws=${encodeParam(ws)}&limit=${limit}&skip=${skip}&sync=${sync ? 1 : 0}&all=${allRefs ? 1 : 0}`
    ),
  commit: (ws, rev) => call('GET', `/commit?ws=${encodeParam(ws)}&rev=${encodeParam(rev)}`),
  revision: (ws, rev, path = '', full = false) =>
    call(
      'GET',
      `/revision?ws=${encodeParam(ws)}&rev=${encodeParam(rev)}&path=${encodeParam(path)}&full=${full ? 1 : 0}`
    ),
  syncInfo: (ws) => call('GET', `/sync-info?ws=${encodeParam(ws)}`),
  startOperation: (body) => call('POST', '/operations', body),
  latestOperation: (ws) => call('GET', `/operations?ws=${encodeParam(ws)}`),
  job: (id) => call('GET', `/operations/${encodeParam(id)}`),
  cancelOperation: (id) => call('POST', `/operations/${encodeParam(id)}/cancel`, {}),
  tree: (ws, path = '') => call('GET', `/tree?ws=${encodeParam(ws)}&path=${encodeParam(path)}`),
  file: (ws, path) => call('GET', `/file?ws=${encodeParam(ws)}&path=${encodeParam(path)}`),
  // 直接交给浏览器下；目录由后端现场压成 zip。
  downloadUrl: (ws, path) => `${PREFIX}/download?ws=${encodeParam(ws)}&path=${encodeParam(path)}`,
  save: (ws, path, text) => call('POST', '/save', { ws, path, text }),
  search: (ws, text, mode = 'name', path = '') =>
    call(
      'GET',
      `/search?ws=${encodeParam(ws)}&q=${encodeParam(text)}&mode=${encodeParam(mode)}&path=${encodeParam(path)}`
    ),
}
