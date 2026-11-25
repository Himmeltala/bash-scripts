/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\test\terminalProtocol.test.js
 * @Description: 终端协议：二进制块的序号头、按键编码与 WebSocket 地址。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  controlMessage,
  encodeInput,
  parseChunk,
  terminalSocketUrl,
} from '../src/features/terminal/lib/protocol.js'

test('输出块前 4 字节是序号，后面是原始字节', () => {
  const buffer = new ArrayBuffer(9)
  new DataView(buffer).setUint32(0, 42)
  new Uint8Array(buffer).set([0x68, 0x69, 0x0a, 0xff, 0x00], 4)
  const chunk = parseChunk(buffer)
  assert.equal(chunk.seq, 42)
  assert.deepEqual([...chunk.data], [0x68, 0x69, 0x0a, 0xff, 0x00])
  assert.equal(parseChunk(new ArrayBuffer(3)), null)
})

test('按键按 UTF-8 编码，控制消息是 JSON', () => {
  assert.deepEqual([...encodeInput('中')], [0xe4, 0xb8, 0xad])
  assert.deepEqual(JSON.parse(controlMessage('resize', { cols: 80 })), {
    type: 'resize',
    cols: 80,
  })
})

test('WebSocket 地址带工作区、会话、行列与重放位置', () => {
  const url = terminalSocketUrl({ wsId: 'w1', sessionId: 's1', cols: 120, rows: 40, since: 7 })
  assert.equal(url.startsWith('ws://'), true)
  assert.match(url, /\/__idex\/api\/terminal\/ws\?/)
  const params = new URL(url).searchParams
  assert.equal(params.get('ws'), 'w1')
  assert.equal(params.get('session'), 's1')
  assert.equal(params.get('cols'), '120')
  assert.equal(params.get('rows'), '40')
  assert.equal(params.get('since'), '7')
})
