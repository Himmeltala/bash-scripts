/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\terminal\composables\useTerminalConnection.js
 * @Description: 一条终端的 WebSocket 连接：输入、输出、确认、断线重连。
 */
import { markRaw } from 'vue'
import { controlMessage, parseChunk, terminalSocketUrl } from '../lib/protocol'

export function connectTerminal(slot, { onData, onReady, onExit, onError }) {
  const conn = markRaw({
    socket: null,
    stopped: false,
    retry: 0,
    timer: 0,
    sendInput,
    resize,
    ack,
    close,
  })

  function open() {
    if (conn.stopped || !slot.term) return
    const socket = new WebSocket(
      terminalSocketUrl({
        wsId: slot.wsId,
        sessionId: slot.id || '',
        cols: slot.term.cols,
        rows: slot.term.rows,
        since: slot.since || 0,
      }),
    )
    socket.binaryType = 'arraybuffer'
    conn.socket = socket
    socket.onopen = () => {
      conn.retry = 0
      slot.status = 'running'
    }
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        let message = null
        try {
          message = JSON.parse(event.data)
        } catch (err) {
          return
        }
        if (message.type === 'ready') {
          slot.id = message.id || slot.id
          slot.title = message.title || slot.title
          slot.status = 'running'
          onReady?.(message)
        } else if (message.type === 'exit') {
          slot.status = 'exited'
          onExit?.(message)
        } else if (message.type === 'error') {
          slot.status = 'error'
          conn.stopped = true
          onError?.(message.error || '终端出错了')
          socket.close()
        }
        return
      }
      const chunk = parseChunk(event.data)
      if (!chunk) return
      slot.since = chunk.seq
      onData?.(chunk.seq, chunk.data)
    }
    socket.onclose = () => {
      conn.socket = null
      if (conn.stopped || slot.status === 'exited') return
      slot.status = 'connecting'
      const wait = Math.min(5000, 300 * 2 ** conn.retry)
      conn.retry += 1
      conn.timer = setTimeout(open, wait)
    }
    socket.onerror = () => {
      socket.close()
    }
  }

  function sendInput(bytes) {
    if (conn.socket && conn.socket.readyState === WebSocket.OPEN) conn.socket.send(bytes)
  }

  function resize(cols, rows) {
    if (conn.socket && conn.socket.readyState === WebSocket.OPEN) {
      conn.socket.send(controlMessage('resize', { cols, rows }))
    }
  }

  function ack(seq) {
    if (conn.socket && conn.socket.readyState === WebSocket.OPEN) {
      conn.socket.send(controlMessage('ack', { seq }))
    }
  }

  function close() {
    conn.stopped = true
    clearTimeout(conn.timer)
    if (conn.socket) {
      conn.socket.close()
      conn.socket = null
    }
  }

  open()
  return conn
}
