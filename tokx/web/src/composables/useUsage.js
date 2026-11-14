// 取数：页面保持一条 SSE 长连接，服务端每 5 秒推来整份报表，前端只负责画。
// 断线由 EventSource 自己重连，重连后服务端先推当前值；页面不再手动刷新。

import { ref } from 'vue'
import { query } from './useView'

export const data = ref(null)
export const error = ref('')
export const loadedAt = ref('')

let source = null

function apply(payload) {
  data.value = payload
  loadedAt.value = payload.now
  error.value = ''
}

// 换筛选条件时先关旧连接，再按新参数连；推送间隔由服务端统一取 5 秒。
export function subscribe() {
  close()
  source = new EventSource(`/api/usage/stream?${query()}`)
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
