/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:47:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:47:00
 * @FilePath: \idex\web\src\composables\useCommitLog.js
 * @Description: 提交日志的取数：首屏、远端同步、加载更多、选中提交与差异。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../utils/api.js'
import { isDeferred } from '../utils/deferred.js'

export function useCommitLog({ wsId, refresh, allBranches, diffScope, isGit, page = 50, client = api, autoStart = true }) {
  const entries = ref([])
  const current = ref(null)
  const detail = ref(null)
  const remote = ref(null)
  const activePath = ref('')
  const content = ref({ text: '', truncated: false })
  // 锁文件与构建产物不自动取差异。同一提交里点过“加载差异”的路径记下来，换回来不再拦；
  // 换提交要重新拦一次，同一个路径在不同提交里的差异是另一份。
  const revealed = ref(new Set())
  // 单行过长要等第一次取到差异才知道，按“提交 + 路径”记住，换回来不必再请求。
  const widePaths = ref(new Set())
  const loading = ref(false)
  const syncing = ref(false)
  const moreLoading = ref(false)
  const exhausted = ref(false)
  const diffLoading = ref(false)
  const error = ref('')
  const diffError = ref('')
  let diffSeq = 0
  // 连续切工作副本或连点刷新时，晚到的旧结果不能盖住新的一次加载。
  let loadSeq = 0

  const deferredKey = (path) => `${current.value ? current.value.revision : ''}\n${path}`
  const marked = (path) => isDeferred(path) || widePaths.value.has(deferredKey(path))
  const held = (path) => !!path && marked(path) && !revealed.value.has(deferredKey(path))
  const awaitingLoad = computed(() => held(activePath.value))

  // 先用本地已有的记录把列表画出来，再让后端连远端同步一次。同步慢的是网络，不该挡着看日志。
  async function load() {
    const mine = ++loadSeq
    loading.value = true
    error.value = ''
    try {
      const data = await client.log(wsId(), page, 0, false, allBranches.value)
      if (mine !== loadSeq) return
      await applyEntries(data.entries || [])
      remote.value = data.remote || null
    } catch (err) {
      if (mine === loadSeq) error.value = err.message
    } finally {
      if (mine === loadSeq) loading.value = false
    }
    // SVN 的日志每次都从仓库现取，没有“先本地后远端”这一说，不用再同步一次。
    if (isGit()) syncRemote(mine)
  }

  async function syncRemote(mine) {
    syncing.value = true
    try {
      const data = await client.log(wsId(), page, 0, true, allBranches.value)
      if (mine !== loadSeq) return
      remote.value = data.remote || null
      // 已经翻过几页时不再替换首屏，免得把“加载更多”的结果截掉。
      if (entries.value.length > page) return
      await applyEntries(data.entries || [])
    } catch (err) {
      if (mine === loadSeq) error.value = err.message
    } finally {
      if (mine === loadSeq) syncing.value = false
    }
  }

  // 换一批提交：路径只取过一次，刷新后按提交号接着用，免得重复请求。
  async function applyEntries(list) {
    const cached = new Map(entries.value.map((entry) => [entry.revision, entry.paths]))
    for (const entry of list) {
      if (!entry.paths.length && cached.has(entry.revision)) entry.paths = cached.get(entry.revision)
    }
    entries.value = list
    exhausted.value = list.length < page
    const revision = current.value && current.value.revision
    const hit = revision ? entries.value.find((entry) => entry.revision === revision) : null
    if (hit) {
      // 同一条提交还在，选中项换成新对象即可，详情与差异不动。
      current.value = hit
      return
    }
    await select(entries.value[0] || null)
  }

  async function more() {
    if (moreLoading.value || exhausted.value) return
    moreLoading.value = true
    try {
      const data = await client.log(wsId(), page, entries.value.length, false, allBranches.value)
      const seen = new Set(entries.value.map((entry) => entry.revision))
      const fresh = (data.entries || []).filter((entry) => !seen.has(entry.revision))
      entries.value = entries.value.concat(fresh)
      exhausted.value = fresh.length < page
    } catch (err) {
      error.value = err.message
    } finally {
      moreLoading.value = false
    }
  }

  async function select(entry) {
    current.value = entry
    detail.value = null
    activePath.value = ''
    content.value = { text: '', truncated: false }
    diffError.value = ''
    if (!entry) return
    if (!entry.paths.length) {
      // git 的列表不带路径，选中这一条时从提交详情里取一次，取到就记在这条提交上。
      const data = await loadDetail(entry)
      if (!current.value || current.value.revision !== entry.revision) return
      if (data && data.paths) entry.paths = data.paths
    } else {
      // SVN 的日志本来就带路径，说明照样后台取，差异不用等它。
      loadDetail(entry)
    }
    // 提交里的文件常常好几个，默认打开第一个，省一次点击。
    if (entry.paths.length) await openPath(entry.paths[0].path)
  }

  async function loadDetail(entry) {
    try {
      const data = await client.commit(wsId(), entry.revision)
      // 连点不同提交时，晚到的旧结果不能盖住当前选中的说明。
      if (current.value && current.value.revision === entry.revision) detail.value = data
      return data
    } catch (err) {
      // 取不到就继续用列表里的第一行，不影响看差异。
      return null
    }
  }

  async function openPath(path) {
    if (!current.value) return
    activePath.value = path
    await loadDiff(path)
  }

  async function wholeCommit() {
    activePath.value = ''
    await loadDiff('')
  }

  // 用户在右侧点了“加载差异”：记住这一份，再走正常的取差异流程。
  function showDeferred() {
    if (!activePath.value) return
    revealed.value.add(deferredKey(activePath.value))
    loadDiff(activePath.value)
  }

  async function loadDiff(path) {
    if (path && held(path)) {
      // 大文件连差异接口都不请求：记下序号让在途的旧结果作废，页面只显示占位。
      diffSeq += 1
      diffLoading.value = false
      diffError.value = ''
      content.value = { text: '', truncated: false }
      return
    }
    const mine = ++diffSeq
    diffLoading.value = true
    diffError.value = ''
    try {
      const data = await client.revision(
        wsId(),
        current.value.revision,
        path,
        diffScope.value === 'file'
      )
      // 连点提交或来回切口径时，晚到的旧结果不能盖住当前这一份。
      if (mine !== diffSeq) return
      if (path && data.wide && !revealed.value.has(deferredKey(path))) {
        // 单行太长：差异取到也不渲染，记下这一份，换回来直接走占位。
        widePaths.value.add(deferredKey(path))
        content.value = { text: '', truncated: false }
        return
      }
      content.value = data
    } catch (err) {
      if (mine !== diffSeq) return
      content.value = { text: '', truncated: false }
      diffError.value = err.message
    } finally {
      if (mine === diffSeq) diffLoading.value = false
    }
  }

  // 切换差异口径时按当前看的内容重新取一遍。
  if (autoStart) {
    watch(diffScope, () => {
      if (current.value) loadDiff(activePath.value)
    })
    watch(wsId, load)
    watch(refresh, load)
    watch(allBranches, load)
    onMounted(load)
  }

  return {
    entries,
    current,
    detail,
    remote,
    activePath,
    content,
    marked,
    awaitingLoad,
    loading,
    syncing,
    moreLoading,
    exhausted,
    diffLoading,
    error,
    diffError,
    load,
    more,
    select,
    openPath,
    wholeCommit,
    showDeferred,
  }
}
