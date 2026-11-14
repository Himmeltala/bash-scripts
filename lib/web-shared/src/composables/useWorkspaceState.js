// 工作区页面的公共状态：SSE 推送、动作串行、增删工作区与日志接口的调用。
// 各工具只差工具链候选（Node / JDK）与提示文案，接口地址由调用方给。

import { computed, reactive, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { runningCount } from '../utils/services.js'
import { useToast } from './useToast.js'

export function useWorkspaceState({
  api,
  storageKey,
  extraState = {},
  loadExtra = null,
  addedNotice = '已添加',
}) {
  const state = reactive({ workspaces: [], ...extraState })
  const currentId = useLocalStorage(storageKey, '', { writeDefaults: false })
  const adding = ref(false)
  const metrics = ref(null)
  const { snack, toast } = useToast()
  let source = null
  let busy = 0

  const current = computed(() => state.workspaces.find((w) => w.id === currentId.value) || null)
  const running = computed(() => state.workspaces.reduce((sum, ws) => sum + runningCount(ws), 0))

  function select(id) {
    currentId.value = id || ''
  }

  function applyState(data) {
    state.workspaces = data.workspaces || []
    if (currentId.value && !current.value) select('')
  }

  async function refresh() {
    if (busy) return
    try {
      applyState(await api.state())
    } catch (err) {
      // 取不到就先留着现有列表，下一次推送再补。
    }
  }

  // 状态与头部指标共用一条连接，页面不再自己轮询。
  function connectState() {
    source = new EventSource(api.stateStreamUrl())
    source.addEventListener('state', (ev) => {
      // 动作进行中就别画，免得把中间态当成结果。
      if (busy) return
      try {
        applyState(JSON.parse(ev.data))
      } catch (err) {
        // 单条坏了跳过，下一次推送再补。
      }
    })
    source.addEventListener('metrics', (ev) => {
      if (document.hidden) return
      try {
        metrics.value = JSON.parse(ev.data)
      } catch (err) {
      }
    })
  }

  function disconnect() {
    if (source) {
      source.close()
      source = null
    }
  }

  async function loadProvider() {
    if (!loadExtra) return
    try {
      await loadExtra(state)
    } catch (err) {
      // 取不到只是下拉里没有候选，手动填路径仍然可用。
    }
  }

  async function act(label, fn) {
    busy += 1
    try {
      return await fn()
    } catch (err) {
      toast(`${label}失败：${err.message}`, 'error')
      return null
    } finally {
      busy -= 1
      refresh()
    }
  }

  async function addWorkspace(root) {
    const path = typeof root === 'string' ? root : ''
    adding.value = true
    const ok = await act('添加工作区', async () => {
      await api.addWorkspace(path)
      return true
    })
    adding.value = false
    if (!ok) return
    // 目录加来加去可能落到已有的工作区上，按目录重新找选中项。
    await refresh()
    const hit = state.workspaces.find((w) => w.root === path || w.root === path.replace(/\/+$/, ''))
    if (hit) select(hit.id)
    toast(addedNotice, 'primary')
  }

  async function removeWorkspace(id) {
    const ok = await act('移出工作区', async () => {
      await api.forgetWorkspace(id)
      return true
    })
    if (ok) {
      if (currentId.value === id) select('')
      toast('已移出，在跑的进程一并停了')
    }
  }

  async function rescan() {
    if (!current.value) return
    await act('重新扫描', () => api.rescan(current.value.id))
  }

  async function startService(payload) {
    const ok = await act('启动', () => api.start(payload))
    if (ok) toast('已发出启动', 'primary')
  }

  async function stopService(run) {
    const ok = await act('停止', () => api.stop(run))
    if (ok) toast('已停止')
  }

  async function saveService(payload) {
    const ok = await act('保存参数', () => api.update(payload))
    if (ok) toast('参数已保存', 'primary')
  }

  async function start() {
    connectState()
    await refresh()
    loadProvider()
  }

  return {
    state,
    current,
    currentId,
    adding,
    snack,
    toast,
    metrics,
    running,
    select,
    refresh,
    act,
    start,
    disconnect,
    addWorkspace,
    removeWorkspace,
    rescan,
    startService,
    stopService,
    saveService,
  }
}
