/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:05:00
 * @FilePath: \idex\web\src\stores\settings.js
 * @Description: 服务端设置的唯一内存模型：启动读一次，组件只读，保存只走 save()。
 */

import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { api } from '../utils/api'

// 深拷贝默认值：指标表、快捷键是引用类型，别让界面改到登记表本身。
function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

export const useSettingsStore = defineStore('settings', () => {
  // schema 是登记表元数据，values 是服务端已生效值，draft 是未保存修改。
  const schema = ref([])
  const values = ref({})
  const draft = reactive({})
  const loaded = ref(false)
  const saving = ref(false)

  const byKey = computed(() => new Map(schema.value.map((item) => [item.key, item])))
  const defaults = computed(() => {
    const out = {}
    for (const item of schema.value) out[item.key] = item.default
    return out
  })
  const dirtyKeys = computed(() => Object.keys(draft))
  const dirtyCount = computed(() => dirtyKeys.value.length)

  // 读取顺序：未保存修改 → 服务端值 → 登记表默认值。
  function get(key) {
    if (key in draft) return draft[key]
    if (key in values.value) return values.value[key]
    const item = byKey.value.get(key)
    return item ? item.default : undefined
  }

  function isDirty(key) {
    return key in draft
  }

  function set(key, value) {
    if (!isDirty(key) && JSON.stringify(value) === JSON.stringify(get(key))) return
    draft[key] = value
  }

  // 放弃这一项的修改，回到服务端值。
  function reset(key) {
    delete draft[key]
  }

  // 恢复这一项的默认值（先记进 draft，保存后才落盘）；已经等于默认就不用记脏。
  function resetToDefault(key) {
    const item = byKey.value.get(key)
    if (!item) return
    const stored = key in values.value ? values.value[key] : item.default
    if (JSON.stringify(clone(item.default)) === JSON.stringify(stored)) {
      delete draft[key]
      return
    }
    draft[key] = clone(item.default)
  }

  function discard() {
    for (const key of Object.keys(draft)) delete draft[key]
  }

  async function load(force = false) {
    if (loaded.value && !force) return
    const data = await api.settings()
    schema.value = Array.isArray(data.schema) ? data.schema : []
    values.value = data.values || {}
    loaded.value = true
  }

  // 一次提交全部脏项；先乐观应用，失败回滚并把修改放回 draft。
  async function save() {
    const patch = clone(draft)
    if (!Object.keys(patch).length) return true
    saving.value = true
    const before = { ...values.value }
    const previousDraft = patch
    Object.assign(values.value, patch)
    discard()
    try {
      const data = await api.saveSettingValues(patch)
      if (data && data.values) values.value = data.values
      return true
    } catch (err) {
      values.value = before
      Object.assign(draft, previousDraft)
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    schema,
    values,
    draft,
    loaded,
    saving,
    byKey,
    defaults,
    dirtyKeys,
    dirtyCount,
    get,
    isDirty,
    set,
    reset,
    resetToDefault,
    discard,
    load,
    save,
  }
})
