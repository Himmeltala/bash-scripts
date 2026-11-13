import { computed, reactive, ref } from 'vue'
import { highlightCode, languageOf } from '../../utils/highlight.js'

// 文件草稿与保存状态。取数与落盘由调用方传进来，组件不认具体接口。
export function useFileEditor({ loader, saver }) {
  const path = ref('')
  const state = reactive({
    base: '',
    draft: '',
    loading: false,
    error: '',
    saving: false,
    saveError: '',
  })
  let seq = 0

  const dirty = computed(() => state.draft !== state.base)
  const language = computed(() => languageOf(path.value))
  // 末尾的换行只对应编辑框里多出来的空行，行号按编辑框的实际行数走。
  const draftText = computed(() =>
    state.draft.endsWith('\n') ? state.draft.slice(0, -1) : state.draft,
  )
  const lineCount = computed(() => state.draft.split('\n').length)
  const highlighted = computed(() => highlightCode(draftText.value, language.value))

  async function load(target) {
    path.value = target
    const mine = ++seq
    state.loading = true
    state.error = ''
    state.saveError = ''
    state.base = ''
    state.draft = ''
    try {
      const data = await loader(target)
      if (mine !== seq) return false
      state.base = (data.text || '').replace(/\r\n?/g, '\n')
      state.draft = state.base
      return true
    } catch (err) {
      if (mine !== seq) return false
      state.error = err.message
      return false
    } finally {
      if (mine === seq) state.loading = false
    }
  }

  async function save() {
    if (state.saving || !dirty.value || !path.value) return null
    const target = path.value
    state.saving = true
    state.saveError = ''
    try {
      const data = await saver(target, state.draft)
      // 保存期间可能已经换到别的文件，那边的内容不能被这份草稿盖掉。
      if (path.value === target) state.base = state.draft
      return data
    } catch (err) {
      if (path.value === target) state.saveError = err.message
      return null
    } finally {
      state.saving = false
    }
  }

  function reset() {
    seq += 1
    path.value = ''
    state.base = ''
    state.draft = ''
    state.loading = false
    state.error = ''
    state.saving = false
    state.saveError = ''
  }

  return { path, state, dirty, lineCount, highlighted, load, save, reset }
}
