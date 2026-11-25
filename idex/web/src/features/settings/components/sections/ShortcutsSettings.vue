<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\settings\components\sections\ShortcutsSettings.vue
 * @Description: 快捷键设置：点一下再按新组合，存服务端，页面各处按键处理共用。
-->
<template>
  <div v-for="group in groups" :key="group.title" class="group">
    <p class="group-title">{{ group.title }}</p>
    <SettingsItem
      v-for="item in group.items"
      :key="item.id"
      :label="item.title"
    >
      <button
        type="button"
        class="key"
        :class="{ recording: recording === item.id, clash: clashes.has(item.id) }"
        :title="clashes.has(item.id) ? '和别的快捷键撞了' : '点击后按下新的组合；Esc 取消，Backspace 清除'"
        @click="startRecord(item.id)"
      >
        {{ recording === item.id ? '按下组合…' : draft[item.id] || '未设置' }}
      </button>
    </SettingsItem>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import { usePreferencesStore } from '../../../../stores/preferences'
import {
  SHORTCUT_DEFAULTS,
  SHORTCUT_GROUPS,
  bindingFromEvent,
} from '../../lib/shortcuts'
import SettingsItem from '../SettingsItem.vue'

const preferences = usePreferencesStore()
const groups = SHORTCUT_GROUPS
const draft = ref({ ...SHORTCUT_DEFAULTS })
const recording = ref('')
const defaults = ref({ ...SHORTCUT_DEFAULTS })

const clashes = computed(() => {
  const seen = new Map()
  const hit = new Set()
  for (const [id, value] of Object.entries(draft.value)) {
    if (!value) continue
    if (seen.has(value)) {
      hit.add(id)
      hit.add(seen.get(value))
    } else {
      seen.set(value, id)
    }
  }
  return hit
})

function startRecord(id) {
  stopRecord()
  recording.value = id
  window.addEventListener('keydown', onRecordKey, true)
}

function stopRecord() {
  if (!recording.value) return
  window.removeEventListener('keydown', onRecordKey, true)
  recording.value = ''
}

function onRecordKey(event) {
  if (!recording.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    stopRecord()
    return
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    draft.value = { ...draft.value, [recording.value]: '' }
    stopRecord()
    return
  }
  const value = bindingFromEvent(event)
  if (!value) return
  draft.value = { ...draft.value, [recording.value]: value }
  stopRecord()
}

async function load() {
  const data = await api.settings()
  defaults.value = { ...SHORTCUT_DEFAULTS, ...(data.defaults && data.defaults.shortcuts) }
  draft.value = { ...defaults.value, ...(data.shortcuts || {}) }
}

function reset() {
  stopRecord()
  draft.value = { ...defaults.value }
}

async function save() {
  if (clashes.value.size) {
    toast('有快捷键撞在一起了，先改成不同的组合', 'error')
    return false
  }
  try {
    await api.saveSettings({ shortcuts: draft.value })
    preferences.shortcuts = { ...draft.value }
    return true
  } catch (err) {
    toast(`保存快捷键失败：${err.message}`, 'error')
    return false
  }
}

onBeforeUnmount(stopRecord)

defineExpose({ save, reset })
</script>

<style scoped>
.group + .group {
  margin-top: 12px;
}
.group-title {
  margin: 0 0 4px;
  font-size: 0.76rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
}
.key {
  min-width: 110px;
  padding: 3px 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.24);
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  font-size: 0.78rem;
  font-family: var(--mono-font, monospace);
  cursor: pointer;
}
.key:hover {
  border-color: rgb(var(--v-theme-primary));
}
.key.recording {
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
.key.clash {
  border-color: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-error));
}
</style>
