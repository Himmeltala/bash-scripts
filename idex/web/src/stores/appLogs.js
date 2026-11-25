/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\stores\appLogs.js
 * @Description: 页面日志的共享状态：入口徽标与日志面板共用一份数据，只轮询一次。
 */
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { api } from '../utils/api'

const PAGE = 200
const POLL_MS = 10000

export const useAppLogsStore = defineStore('appLogs', () => {
  const items = ref([])
  const counts = reactive({ error: 0, warning: 0, info: 0 })
  const total = ref(0)
  const hasMore = ref(false)
  const loading = ref(false)
  const error = ref('')
  const level = ref('all')
  const queryLevel = computed(() => (level.value === 'all' ? '' : level.value))
  let timer = null
  let started = false

  function apply(data, { reset = false } = {}) {
    total.value = data.total || 0
    Object.assign(counts, { error: 0, warning: 0, info: 0 }, data.counts || {})
    const page = Array.isArray(data.items) ? data.items : []
    if (reset) {
      items.value = page
    } else {
      const seen = new Set(items.value.map((item) => item.id))
      items.value = page.filter((item) => !seen.has(item.id)).concat(items.value)
    }
    hasMore.value = reset ? !!data.has_more : !!data.has_more || (items.value.length > 0 && !!data.next_before)
    error.value = ''
  }

  async function load() {
    loading.value = true
    try {
      apply(await api.logs({ limit: PAGE, level: queryLevel.value }), { reset: true })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function more() {
    if (!hasMore.value || !items.value.length) return
    const before = items.value[items.value.length - 1].id
    loading.value = true
    try {
      const data = await api.logs({ before, limit: PAGE, level: queryLevel.value })
      const seen = new Set(items.value.map((item) => item.id))
      items.value = items.value.concat((data.items || []).filter((item) => !seen.has(item.id)))
      total.value = data.total || total.value
      Object.assign(counts, data.counts || {})
      hasMore.value = !!data.has_more
      error.value = ''
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function poll() {
    if (document.hidden) return
    try {
      apply(await api.logs({ limit: PAGE, level: queryLevel.value }), { reset: false })
    } catch (err) {
      // 轮询失败不提示，下一次再试。
    }
  }

  // 入口与面板共用：第一次用到时读一次、开一次轮询，之后一直复用。
  function ensure() {
    if (started) return
    started = true
    load()
    timer = setInterval(poll, POLL_MS)
  }

  async function clear() {
    try {
      await api.clearLogs()
      items.value = []
      total.value = 0
      Object.assign(counts, { error: 0, warning: 0, info: 0 })
      hasMore.value = false
      error.value = ''
    } catch (err) {
      error.value = err.message
    }
  }

  watch(level, load)

  return { items, counts, total, hasMore, loading, error, level, load, more, clear, ensure }
})
