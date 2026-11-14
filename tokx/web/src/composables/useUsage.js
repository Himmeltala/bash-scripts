// 取数：页面保持一条 SSE 长连接，服务端按间隔推来整份报表，前端只负责画。
// 手动刷新仍走一次 /api/usage；断线由 EventSource 自己重连，重连后服务端先推当前值。

import { ref } from 'vue'
import { createJsonClient } from '@bash-scripts/web-shared/http'
import { query } from './useView'

// 手动刷新与 SSE 推送取的都是同一份报表；错误文案沿用原来的后端 error 优先。
const client = createJsonClient({
  prefix: '/api',
  messageOf: ({ data, status, response }) =>
    (data && data.error) || response.statusText || `请求失败（${status}）`,
  treatPayloadError: true,
})

export const data = ref(null)
export const error = ref('')
export const busy = ref(false)
export const loadedAt = ref('')

let source = null

function apply(payload) {
  data.value = payload
  loadedAt.value = payload.now
  error.value = ''
}

export async function load() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const payload = await client.call('GET', `/usage?${query()}`)
    apply(payload)
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

// 换筛选条件或推送间隔时先关旧连接，再按新参数连；every 为 0 表示不自动更新。
export function subscribe(every = 5) {
  close()
  if (!every) return
  const params = query({ every: String(every) })
  source = new EventSource(`/api/usage/stream?${params}`)
  source.addEventListener('usage', (event) => {
    try {
      apply(JSON.parse(event.data))
    } catch (err) {
      error.value = '推送的数据解析失败'
    }
  })
  source.addEventListener('failure', (event) => {
    try {
      error.value = JSON.parse(event.data).error || '服务端推送失败'
    } catch (err) {
      error.value = '服务端推送失败'
    }
  })
  source.addEventListener('error', () => {
    // 断线后 EventSource 会自己重连；只有它放弃重连时才留下提示。
    if (source && source.readyState === EventSource.CLOSED) error.value = '推送连接已断开'
  })
}

export function close() {
  if (source) source.close()
  source = null
}
