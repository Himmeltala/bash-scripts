/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:12:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:12:00
 * @FilePath: \dvcsx\web\src\composables\useDiagnostics.js
 * @Description: 当前文件的诊断：取数、防抖、行号圆点与问题列表的统计。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { api } from '../utils/api.js'
import { markersOf, statsOf } from '../utils/diagnostics.js'

export function useDiagnostics({ wsId, activePath, editorOf, onOpen }) {
  const problems = ref([])
  const problemsAsk = reactive({ on: false })
  const problemsLoading = ref(false)
  let diagSeq = 0
  let diagTimer = 0
  let editTimer = 0

  const problemStats = computed(() => statsOf(problems.value))
  const markers = computed(() => markersOf(problems.value))

  // 先取一次，服务器是异步推的，1.6 秒后再取一次补上。
  function refreshDiagnostics(path = activePath.value) {
    const seq = ++diagSeq
    clearTimeout(diagTimer)
    // 换文件时先把转圈收掉，旧请求回来时序号已经对不上，不会再把它打开。
    problemsLoading.value = false
    if (!path) {
      problems.value = []
      return
    }
    const run = async () => {
      if (seq !== diagSeq || path !== activePath.value) return
      const editor = editorOf(path)
      if (!editor || !editor.path) return
      problemsLoading.value = true
      try {
        const data = await api.diagnostics(wsId(), path, editor.text)
        if (seq === diagSeq && path === activePath.value) problems.value = data.diagnostics || []
      } catch (err) {
        if (seq === diagSeq && path === activePath.value) problems.value = []
      } finally {
        if (seq === diagSeq && path === activePath.value) problemsLoading.value = false
      }
    }
    run()
    diagTimer = setTimeout(run, 1600)
  }

  // 编辑停下 900 毫秒再问一次，边打字边问会把服务器问烦。
  function onEdit({ path }) {
    if (path !== activePath.value) return
    clearTimeout(editTimer)
    editTimer = setTimeout(() => refreshDiagnostics(path), 900)
  }

  function onProblem(item) {
    problemsAsk.on = false
    onOpen({ path: activePath.value, line: item.line, character: item.character })
  }

  onBeforeUnmount(() => {
    clearTimeout(diagTimer)
    clearTimeout(editTimer)
    diagSeq += 1
  })

  return {
    problems,
    problemsAsk,
    problemsLoading,
    problemStats,
    markers,
    refreshDiagnostics,
    onEdit,
    onProblem,
  }
}
