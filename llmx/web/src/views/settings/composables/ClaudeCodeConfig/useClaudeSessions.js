// 会话清单、单个会话的用量明细与移进回收目录。

import { reactive, ref } from 'vue'
import { get, post } from '../../../../composables/useApi'

export function useClaudeSessions() {
  const items = ref([])
  const dir = ref('')
  const garbage = ref('')
  const writable = ref(true)
  const loaded = ref(false)
  const error = ref('')

  async function refresh() {
    try {
      const data = await get('/claude/sessions')
      items.value = data.sessions
      dir.value = data.dir
      garbage.value = data.garbage
      writable.value = data.writable
      error.value = ''
    } catch (err) {
      error.value = err.message
    } finally {
      loaded.value = true
    }
  }

  function detail(id) {
    return get(`/claude/sessions/detail?id=${encodeURIComponent(id)}`)
  }

  // 回收目录里的会话清单，打开回收站弹窗时才读。
  function garbageList() {
    return get('/claude/sessions/garbage')
  }

  async function restore(ids) {
    const data = await post('/claude/sessions/restore', { ids })
    await refresh()
    return data
  }

  async function purge(ids) {
    const data = await post('/claude/sessions/purge', { ids })
    return data
  }

  async function trash(ids) {
    const data = await post('/claude/sessions/delete', { ids })
    await refresh()
    return data
  }

  // 与配置档一样用 reactive 包，模板里直接写 sessions.items。
  return reactive({
    items,
    dir,
    garbage,
    writable,
    loaded,
    error,
    refresh,
    detail,
    garbageList,
    restore,
    purge,
    trash,
  })
}
