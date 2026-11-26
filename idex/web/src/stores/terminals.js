/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 11:20:00
 * @FilePath: \idex\web\src\stores\terminals.js
 * @Description: 跨工作区的终端会话表；xterm、连接与 DOM 都由这里持有，切页签不销毁。
 */
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { api } from '../utils/api'
import { missingSessions, resolveView } from '../features/terminal/lib/groups'

let slotSeq = 0

function emptyGroup() {
  return { items: [], activeKey: '' }
}

export const useTerminalsStore = defineStore('terminals', () => {
  // wsId -> { items: [slot], activeKey }
  const groups = reactive({})
  // Dock 当前查看哪一组；默认跟当前工作区，点标题栏别的组只换这里。
  const viewWsId = ref('')

  function group(wsId) {
    if (!groups[wsId]) groups[wsId] = emptyGroup()
    return groups[wsId]
  }

  function setView(wsId) {
    viewWsId.value = wsId || ''
  }

  // 调用方实际该显示哪组：查看组失效时回落到当前工作区。
  function shown(currentId) {
    const next = resolveView(viewWsId.value, currentId, groups)
    if (next !== viewWsId.value) viewWsId.value = next
    return next
  }

  // 读的时候不建组：渲染期改响应式状态会触发多余的更新。
  function list(wsId) {
    return groups[wsId]?.items || []
  }

  function activeSlot(wsId) {
    const found = groups[wsId]
    if (!found) return null
    return found.items.find((item) => item.key === found.activeKey) || found.items[0] || null
  }

  function createSlot(wsId) {
    slotSeq += 1
    const slot = reactive({
      key: `term-${slotSeq}`,
      wsId,
      id: '',
      title: '终端',
      status: 'connecting',
      since: 0,
      term: null,
      fit: null,
      el: null,
      conn: null,
      search: null,
      webgl: null,
    })
    const found = group(wsId)
    found.items.push(slot)
    found.activeKey = slot.key
    viewWsId.value = wsId
    return slot
  }

  // 刷新页面后界面是空的，但服务端的 PTY 还活着；把会话接回成本地标签。
  async function restore(wsId) {
    if (!wsId) return []
    const found = group(wsId)
    try {
      const data = await api.terminalSessions(wsId)
      const extra = missingSessions(found.items, data?.sessions)
      found.items.unshift(
        ...extra.map((item) => {
          slotSeq += 1
          return reactive({
            key: `term-${slotSeq}`,
            wsId,
            id: item.id,
            title: item.title || '终端',
            status: item.done ? 'exited' : 'running',
            since: 0,
            term: null,
            fit: null,
            el: null,
            conn: null,
            search: null,
            webgl: null,
          })
        }),
      )
    } catch (err) {
      // 取不到列表就按本地为空处理，照常新建一个。
    }
    if (!found.items.length) return createSlot(wsId)
    if (!found.items.some((item) => item.key === found.activeKey)) {
      found.activeKey = found.items[0].key
    }
    return found.items
  }

  function ensureSlot(wsId) {
    const found = group(wsId)
    if (!found.items.length) return createSlot(wsId)
    if (!found.activeKey) found.activeKey = found.items[0].key
    return activeSlot(wsId)
  }

  function setActive(wsId, key) {
    const found = group(wsId)
    if (!found.items.some((item) => item.key === key)) return
    found.activeKey = key
    viewWsId.value = wsId
  }

  async function closeSlot(wsId, key) {
    const found = group(wsId)
    const index = found.items.findIndex((item) => item.key === key)
    if (index < 0) return
    const slot = found.items[index]
    slot.conn?.close()
    slot.term?.dispose()
    if (slot.id) {
      api.terminalClose(wsId, slot.id).catch(() => {})
    }
    found.items.splice(index, 1)
    if (!found.items.length) {
      found.activeKey = ''
      return
    }
    if (found.activeKey === key) {
      found.activeKey = found.items[Math.max(0, index - 1)].key
    }
  }

  // 工作区被移出：断连接、销毁终端，再把这一组从表里删掉。
  function disposeGroup(wsId) {
    const found = groups[wsId]
    if (!found) return
    for (const slot of found.items) {
      slot.conn?.close()
      slot.term?.dispose()
    }
    if (viewWsId.value === wsId) viewWsId.value = ''
    delete groups[wsId]
  }

  function disposeAll() {
    for (const found of Object.values(groups)) {
      for (const slot of found.items) {
        slot.conn?.close()
        slot.term?.dispose()
      }
      found.items = []
      found.activeKey = ''
    }
  }

  return {
    groups,
    viewWsId,
    list,
    activeSlot,
    createSlot,
    ensureSlot,
    restore,
    setActive,
    setView,
    shown,
    closeSlot,
    disposeGroup,
    disposeAll,
  }
})

