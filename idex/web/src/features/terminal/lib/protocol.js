/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\terminal\lib\protocol.js
 * @Description: 终端 WebSocket 的地址、二进制块拆分与按键编码。
 */

const API_PREFIX = '/__idex/api'
// 每敲一键都编码一次，编码器建一份复用，别每次新建。
const encoder = new TextEncoder()

// 二进制块：前 4 字节是序号，后面才是终端输出。
export function parseChunk(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) return null
  const view = new DataView(buffer)
  return { seq: view.getUint32(0), data: new Uint8Array(buffer, 4) }
}

export function encodeInput(text) {
  return encoder.encode(String(text ?? ''))
}

export function terminalSocketUrl({ wsId, sessionId = '', cols = 100, rows = 30, since = 0 }) {
  const scheme = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = globalThis.location?.host || '127.0.0.1'
  const params = new URLSearchParams({
    ws: wsId,
    cols: String(cols || 100),
    rows: String(rows || 30),
    since: String(since || 0),
  })
  if (sessionId) params.set('session', sessionId)
  return `${scheme}//${host}${API_PREFIX}/terminal/ws?${params.toString()}`
}

export function controlMessage(type, payload = {}) {
  return JSON.stringify({ type, ...payload })
}
