/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\stores\terminals.js
 * @Description: 跨工作区的终端会话表；xterm、连接与 DOM 都由这里持有，切页签不销毁。
 */
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { api } from '../utils/api'
import { resolveView } from '../features/terminal/lib/groups'

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

  function list(wsId) {
    return group(wsId).items
  }

  function activeSlot(wsId) {
    const found = group(wsId)
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
    setActive,
    setView,
    shown,
    closeSlot,
    disposeAll,
  }
})

