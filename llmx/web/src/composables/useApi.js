// 接口调用：共享客户端负责 JSON 与错误，前缀是 llmx 自己的 /api。

import { createJsonClient, encodeParam } from '@bash-scripts/web-shared/http'

const { call } = createJsonClient({ prefix: '/api', treatPayloadError: true })

export { call }

export function get(path) {
  return call('GET', path)
}

export function post(path, body = {}) {
  return call('POST', path, body)
}

export function query(name) {
  return `?name=${encodeParam(name)}`
}
