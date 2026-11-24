/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 20:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\src\components\engines\useToolWorkspace.js
 * @Description: 引擎页签的公共状态：按引擎工作区 id 从推送里取对应工作区，引擎断开时留下原因供重试。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

function read(value) {
  return typeof value === 'function' ? value() : value
}

export function pickToolWorkspace(state, engineId) {
  const id = String(read(engineId) || '').trim()
  if (!id) return null
  const list = state && Array.isArray(state.workspaces) ? state.workspaces : []
  return list.find((item) => item && item.id === id) || null
}

// api 是引擎自己的接口表（state、stateStreamUrl）；engineId 给引擎工作区 id。
// localApi 是 idex 的工具探测接口，只在引擎 id 缺失时再探一次。
export function useToolWorkspace({ api, engineId, localApi = null, localId = null }) {
  const state = ref({ workspaces: [] })
  const error = ref('')
  const loading = ref(true)
  const ws = computed(() => pickToolWorkspace(state.value, engineId))
  const registered = computed(() => !!ws.value)
  let source = null
  let alive = true

  function apply(data) {
    state.value = data && Array.isArray(data.workspaces) ? data : { workspaces: [] }
    error.value = ''
    loading.value = false
  }

  async function refresh() {
    try {
      const data = await api.state()
      if (alive) apply(data)
    } catch (err) {
      if (!alive) return
      error.value = err.message || '取不到引擎状态'
      loading.value = false
    }
  }

  function close() {
    if (source) {
      source.close()
      source = null
    }
  }

  function open() {
    close()
    // 页面在后台就不占着服务端的推送线程，回到前台再由 visibilitychange 接回。
    if (!alive || (typeof document !== 'undefined' && document.hidden)) return
    source = new EventSource(api.stateStreamUrl())
    source.addEventListener('state', (event) => {
      try {
        apply(JSON.parse(event.data))
      } catch (err) {
        // 单条坏了跳过，下一次推送再补。
      }
    })
    source.onerror = () => {
      // 503 这类具体原因由 state() 给；推送自己会重连，先留一句能重试的话。
      if (!error.value) error.value = '引擎的状态推送断了，点重试重新连接'
    }
  }

  // 重试：重新取一份状态并接回推送。引擎 id 丢了时顺带让 idex 再探测一次能力。
  async function reload() {
    error.value = ''
    loading.value = true
    const id = read(localId)
    if (localApi && id && !read(engineId)) {
      try {
        await localApi.rescan(id)
      } catch (err) {
        if (!alive) return
        error.value = err.message || '重新探测失败'
        loading.value = false
        return
      }
      if (!alive) return
    }
    await refresh()
    // 请求回来时组件可能已经卸掉：别再开一条没人收的推送。
    if (!alive) return
    open()
  }

  function onVisibility() {
    if (document.hidden) close()
    else open()
  }

  onMounted(() => {
    refresh()
    open()
    document.addEventListener('visibilitychange', onVisibility)
  })
  onBeforeUnmount(() => {
    alive = false
    close()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { state, ws, registered, loading, error, refresh, reload }
}
