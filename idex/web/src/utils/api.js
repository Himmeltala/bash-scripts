/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:18:07
 * @FilePath: \idex\web\src\utils\api.js
 * @Description: idex 的接口封装与 SSE 地址，所有请求都走 /__idex/api。
*/

// 接口封装：所有请求都走 /__idex/api，出错时把后端给的那句话抛出来。

import { createJsonClient, encodeParam } from '@bash-scripts/web-shared/http'

const PREFIX = '/__idex/api'
const { call } = createJsonClient({ prefix: PREFIX })

export { ApiError } from '@bash-scripts/web-shared/http'

// SSE 不能走 fetch，地址单独给页面拼。
export function stateEventsUrl() {
  return `${PREFIX}/state/stream`
}

export function metricsEventsUrl() {
  return `${PREFIX}/metrics/stream`
}

export function workspaceEventsUrl(ws) {
  return `${PREFIX}/events?ws=${encodeParam(ws)}`
}

export function jobEventsUrl(id) {
  return `${PREFIX}/operations/${encodeParam(id)}/events`
}

// 上传一个文件：请求体就是文件本身，名字与目录放查询参数。
// 只有 XHR 能拿到上传进度，所以这里不走 fetch；失败时把状态码挂到 error 上。
export function uploadFile(ws, dir, file, { overwrite = false, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ ws, dir, name: file.name })
    if (overwrite) params.set('overwrite', '1')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${PREFIX}/upload?${params.toString()}`)
    xhr.responseType = 'json'
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total)
      })
    }
    xhr.addEventListener('load', () => {
      const data = xhr.response
      if (xhr.status === 200 && data) {
        resolve(data)
        return
      }
      const err = new Error((data && data.error) || `上传失败（${xhr.status}）`)
      err.status = xhr.status
      reject(err)
    })
    xhr.addEventListener('error', () => reject(new Error('上传中断，检查网络或服务')))
    xhr.addEventListener('abort', () => reject(new Error('上传已取消')))
    xhr.send(file)
  })
}

export const api = {
  state: () => call('GET', '/state'),
  dirs: (path = '') => call('GET', `/dirs${path ? `?path=${encodeParam(path)}` : ''}`),
  addWorkspace: (root) => call('POST', '/workspaces', { root }),
  forgetWorkspace: (ws) => call('POST', '/forget', { ws }),
  setAlias: (ws, alias) => call('POST', '/alias', { ws, alias }),
  saveGroups: (nodes) => call('POST', '/groups', { nodes }),
  changes: (ws) => call('GET', `/changes?ws=${encodeParam(ws)}`),
  diff: (ws, path, item = '', full = false, scope = 'worktree') =>
    call(
      'GET',
      `/diff?ws=${encodeParam(ws)}&path=${encodeParam(path)}&item=${encodeParam(item)}&full=${full ? 1 : 0}&scope=${encodeParam(scope)}`
    ),
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
  original: (ws, path, scope = 'worktree', rev = '', repo = '') =>
    call(
      'GET',
      `/original?ws=${encodeParam(ws)}&path=${encodeParam(path)}&scope=${encodeParam(scope)}&rev=${encodeParam(rev)}&repo=${encodeParam(repo)}`
    ),
  stat: (ws, path = '') => call('GET', `/stat?ws=${encodeParam(ws)}&path=${encodeParam(path)}`),
  // 直接交给浏览器下；目录由后端现场压成 zip。
  downloadUrl: (ws, path) => `${PREFIX}/download?ws=${encodeParam(ws)}&path=${encodeParam(path)}`,
  save: (ws, path, text) => call('POST', '/save', { ws, path, text }),
  stage: (ws, paths) => call('POST', '/stage', { ws, paths }),
  unstage: (ws, paths) => call('POST', '/unstage', { ws, paths }),
  svnAdd: (ws, paths) => call('POST', '/svn-add', { ws, paths }),
  svnUnadd: (ws, paths) => call('POST', '/svn-unadd', { ws, paths }),
  mkdir: (ws, dir, name) => call('POST', '/mkdir', { ws, dir, name }),
  newFile: (ws, dir, name) => call('POST', '/newfile', { ws, dir, name }),
  renameEntry: (ws, path, name) => call('POST', '/rename', { ws, path, name }),
  deleteEntry: (ws, path) => call('POST', '/delete', { ws, path }),
  compress: (ws, path) => call('POST', '/compress', { ws, path }),
  search: (ws, text, mode = 'name', path = '', token = '') =>
    call(
      'GET',
      `/search?ws=${encodeParam(ws)}&q=${encodeParam(text)}&mode=${encodeParam(mode)}&path=${encodeParam(path)}&token=${encodeParam(token)}`
    ),
  settings: () => call('GET', '/settings'),
  saveSettings: (patch) =>
    call('POST', '/settings', Array.isArray(patch) ? { search_ignore: patch } : patch),
  // 代码索引：把编辑框里这份文本和词的位置交给服务端的语言服务器。
  definition: (ws, path, text, line, character) =>
    call('POST', '/lsp/definition', { ws, path, text, line, character }),
  // 右键菜单里的通用查询：definition / typeDefinition / implementation / references。
  query: (ws, path, text, line, character, action) =>
    call('POST', '/lsp/query', { ws, path, text, line, character, action }),
  // 重命名：先预览要改哪些文件，确认后再落盘。
  renamePreview: (ws, path, text, line, character, newName) =>
    call('POST', '/lsp/rename', { ws, path, text, line, character, newName }),
  renameApply: (ws, path, text, line, character, newName) =>
    call('POST', '/lsp/rename-apply', { ws, path, text, line, character, newName }),
  lspStatus: () => call('GET', '/lsp/status'),

  // 页面日志：默认取最新 200 条，更多按 before 往前翻。
  logs: ({ before = '', limit = 200, level = '' } = {}) =>
    call(
      'GET',
      `/logs?limit=${encodeParam(limit)}${before ? `&before=${encodeParam(before)}` : ''}${level ? `&level=${encodeParam(level)}` : ''}`,
    ),
  addLog: (payload) => call('POST', '/logs', payload),
  clearLogs: () => call('POST', '/logs/clear', {}),
  // 整份文件的符号大纲。
  symbols: (ws, path, text) => call('POST', '/lsp/symbols', { ws, path, text }),
  // 悬停信息：类型、函数签名、文档摘要。
  hover: (ws, path, text, line, character) =>
    call('POST', '/lsp/hover', { ws, path, text, line, character }),
  // 补全：带当前草稿全文与光标位置。
  completion: (ws, path, text, line, character, trigger = '') =>
    call('POST', '/lsp/completion', { ws, path, text, line, character, trigger }),
  // 整份格式化：返回要替换的文本区间，由编辑器落进草稿。
  format: (ws, path, text, tabSize = 4, insertSpaces = true) =>
    call('POST', '/lsp/format', { ws, path, text, tabSize, insertSpaces }),
  // 诊断：把当前文本交给服务器，取它推回来的错误与警告。
  diagnostics: (ws, path, text) => call('POST', '/lsp/diagnostics', { ws, path, text }),
  // 还原一块未暂存的改动：只认与当前工作区差异一字不差的块。
  restoreHunk: (ws, path, hunk) => call('POST', '/restore-hunk', { ws, path, hunk }),
  // 快速打开用的整份文件清单。
  files: (ws) => call('GET', `/files?ws=${encodeParam(ws)}`),
  terminalSessions: (ws) => call('GET', `/terminal/sessions?ws=${encodeParam(ws)}`),
  terminalClose: (ws, id) => call('POST', '/terminal/close', { ws, id }),
}
