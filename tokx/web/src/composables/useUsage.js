// 取数：每轮请求都由服务端现扫、写账本、按当前价格表计价，前端只负责画。
// 前一轮没回来时不再发新的，避免几个请求排队把服务端堵住。

import { ref } from 'vue'
import { query } from './useView'

export const data = ref(null)
export const error = ref('')
export const busy = ref(false)
export const loadedAt = ref('')

export async function load() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/usage?${query()}`, { cache: 'no-store' })
    const payload = await res.json()
    if (!res.ok || payload.error) throw new Error(payload.error || res.statusText)
    data.value = payload
    loadedAt.value = payload.now
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
