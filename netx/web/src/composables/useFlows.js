// 出网记录的推送：服务端每 3 秒推一份完整列表与采集状态，断线由 EventSource 自己重连。

import { onBeforeUnmount, ref, watch } from 'vue'

const PREFIX = '/__netx/api'
const LIMIT = 500

export function useFlows(minutes) {
  const rows = ref([])
  const status = ref({})
  const loading = ref(true)
  const connected = ref(false)
  const error = ref('')
  let source = null

  function close() {
    if (source) {
      source.close()
      source = null
    }
  }

  function connect() {
    close()
    // 换时间范围时先清空，免得旧窗口的记录留在表里。
    rows.value = []
    error.value = ''
    loading.value = true
    const query = new URLSearchParams({ minutes: String(minutes.value), limit: String(LIMIT) })
    source = new EventSource(PREFIX + '/flows/stream?' + query.toString())
    source.addEventListener('open', () => {
      connected.value = true
    })
    source.addEventListener('flows', (event) => {
      try {
        const payload = JSON.parse(event.data)
        rows.value = payload.flows || []
        status.value = payload.status || {}
        connected.value = true
        loading.value = false
      } catch (err) {
        error.value = '推送数据解析失败'
      }
    })
    source.onerror = () => {
      connected.value = false
      // EventSource 会自己重连；只有它彻底放弃时才提示用户。
      if (source && source.readyState === EventSource.CLOSED) {
        error.value = '推送连接已断开，刷新页面重试'
      }
    }
  }

  watch(minutes, connect, { immediate: true })
  onBeforeUnmount(close)

  return { rows, status, loading, connected, error }
}
