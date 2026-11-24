/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:09:46
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\features\log\composables\useLogs.js
 * @Description: 服务端日志的分页读取、按级别筛选、轮询新条目与清空。
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { api } from '../../../utils/api'

const PAGE = 200
const POLL_MS = 10000

export function useLogs() {
  const items = ref([])
  const counts = reactive({ error: 0, warning: 0, info: 0 })
  const total = ref(0)
  const hasMore = ref(false)
  const loading = ref(false)
  const error = ref('')
  const level = ref('all')
  let timer = null

  const queryLevel = computed(() => (level.value === 'all' ? '' : level.value))

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
    hasMore.value = !!data.has_more || (items.value.length > 0 && !!data.next_before && !reset)
    if (reset) hasMore.value = !!data.has_more
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

  // 轮询只补比当前最新一条更新的记录，不打断已经往前翻的页。
  async function poll() {
    if (document.hidden) return
    try {
      const data = await api.logs({ limit: PAGE, level: queryLevel.value })
      apply(data, { reset: false })
      if (items.value.length > PAGE) items.value = items.value.slice(0, items.value.length)
    } catch (err) {
      // 轮询失败不提示，下一次再试。
    }
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

  function startPolling() {
    stopPolling()
    timer = setInterval(poll, POLL_MS)
  }

  function stopPolling() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  onBeforeUnmount(stopPolling)

  return { items, counts, total, hasMore, loading, error, level, load, more, poll, clear, startPolling, stopPolling }
}
