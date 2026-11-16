// 配置档的取数与动作：清单、单份内容、增删改、应用前差异。错误由调用方显示。

import { reactive, ref } from 'vue'
import { get, post, query } from '../../../../composables/useApi'

export function useClaudeProfiles() {
  const items = ref([])
  const dir = ref('')
  const target = ref({ path: '', exists: false })
  const writable = ref(true)
  const loaded = ref(false)
  const error = ref('')

  async function refresh() {
    try {
      const data = await get('/profiles/claude')
      items.value = data.profiles
      dir.value = data.dir
      target.value = data.target
      writable.value = data.writable
      error.value = ''
    } catch (err) {
      error.value = err.message
    } finally {
      loaded.value = true
    }
  }

  function load(name) {
    return get(`/profiles/claude/file${query(name)}`)
  }

  function save(name, text) {
    return post('/profiles/claude/save', { name, text })
  }

  async function create(payload) {
    const data = await post('/profiles/claude/create', payload)
    await refresh()
    return data
  }

  async function rename(from, to) {
    const data = await post('/profiles/claude/rename', { from, to })
    await refresh()
    return data
  }

  async function remove(name) {
    const data = await post('/profiles/claude/delete', { name })
    await refresh()
    return data
  }

  function diff(name) {
    return get(`/profiles/claude/diff${query(name)}`)
  }

  async function apply(name) {
    const data = await post('/profiles/claude/apply', { name })
    await refresh()
    return data
  }

  function settings() {
    return get('/claude/settings')
  }

  // 用 reactive 包一层：模板里写 profiles.items 就能直接拿到值，不必层层 .value。
  return reactive({
    items,
    dir,
    target,
    writable,
    loaded,
    error,
    refresh,
    load,
    save,
    create,
    rename,
    remove,
    diff,
    apply,
    settings,
  })
}
