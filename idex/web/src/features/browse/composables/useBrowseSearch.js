/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\browse\composables\useBrowseSearch.js
 * @Description: 浏览页的文件名与内容搜索：防抖、结果归树、目录收起。
 */
import { computed, getCurrentInstance, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { api } from '../../../utils/api.js'
import { buildSearchTree, flattenSearchTree } from '../lib/browseSearchTree.js'

export function useBrowseSearch({ wsId, mode, client = api }) {
  // query 非空时左侧换成结果列表，模式在文件名与内容之间切换。
  const query = ref('')
  const searching = computed(() => String(query.value ?? '').trim() !== '')
  const search = reactive({ loading: false, error: '', matches: [], truncated: false, mode: 'name' })
  // 结果按目录归成树；收起的目录记在这里，重新搜一次就从全展开开始。
  const collapsedDirs = ref(new Set())
  const resultRows = computed(() =>
    flattenSearchTree(buildSearchTree(search.matches), collapsedDirs.value),
  )
  let seq = 0
  let timer = 0

  // 点目录行收起或展开。
  function toggleResultDir(path) {
    const next = new Set(collapsedDirs.value)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    collapsedDirs.value = next
  }

  // 退出搜索：清空输入，结果列表跟着收起来，左侧回到目录树。
  function clearSearch() {
    query.value = ''
    // 空查询带新代次发一次，服务端正扫的那一份看到代次变了就停。
    client.search(wsId(), '', mode.value, '', ++seq).catch(() => {})
    search.matches = []
    search.error = ''
    search.loading = false
    search.truncated = false
  }

  async function runSearch() {
    clearTimeout(timer)
    const text = String(query.value ?? '').trim()
    if (!text) return
    const mine = ++seq
    search.loading = true
    search.error = ''
    try {
      const data = await client.search(wsId(), text, mode.value, '', mine)
      if (mine !== seq) return
      search.matches = data.matches || []
      search.truncated = !!data.truncated
      collapsedDirs.value = new Set()
    } catch (err) {
      if (mine !== seq) return
      search.matches = []
      search.truncated = false
      search.error = err.message
      collapsedDirs.value = new Set()
    } finally {
      if (mine === seq) search.loading = false
    }
  }

  // 输入停下来再搜，免得每敲一个字都扫一遍工作副本；条件一变就让旧结果作废。
  watch([query, mode], () => {
    clearTimeout(timer)
    seq += 1
    search.matches = []
    search.truncated = false
    search.error = ''
    search.mode = mode.value
    if (!searching.value) {
      search.loading = false
      return
    }
    search.loading = true
    timer = setTimeout(runSearch, 300)
  })

  // 在组件里跑时顺手接上卸载清理；单独调用（测试）时不注册生命周期。
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      clearTimeout(timer)
      seq += 1
    })
  }

  return {
    query,
    searching,
    search,
    collapsedDirs,
    resultRows,
    clearSearch,
    toggleResultDir,
    runSearch,
  }
}
