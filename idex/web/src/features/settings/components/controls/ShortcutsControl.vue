<!--
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:35:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:35:00
 * @FilePath: \idex\web\src\features\settings\components\controls\ShortcutsControl.vue
 * @Description: 快捷键录制控件：点一下再按新组合，写进设置草稿，撞键时提示。
-->
<template>
  <div class="shortcuts">
    <div v-for="group in SHORTCUT_GROUPS" :key="group.title" class="group">
      <p class="group-title">{{ group.title }}</p>
      <div v-for="item in group.items" :key="item.id" class="line">
        <span class="name">{{ item.title }}</span>
        <button
          type="button"
          class="key"
          :class="{ recording: recording === item.id, clash: clashes.has(item.id) }"
          :title="clashes.has(item.id) ? '和别的快捷键撞了' : '点击后按下新的组合；Esc 取消，Backspace 清除'"
          @click="startRecord(item.id)"
        >
          {{ recording === item.id ? '按下组合…' : draft[item.id] || '未设置' }}
        </button>
      </div>
    </div>
    <p v-if="clashes.size" class="clash-tip">有快捷键撞在一起了，保存前先改成不同的组合。</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useSettingsStore } from '../../../../stores/settings'
import {
  SHORTCUT_DEFAULTS,
  SHORTCUT_GROUPS,
  SHORTCUT_ITEMS,
  bindingFromEvent,
} from '../../lib/shortcuts'

const settings = useSettingsStore()
const draft = ref({ ...SHORTCUT_DEFAULTS, ...(settings.get('shortcuts') || {}) })
const recording = ref('')

// 同一个键只在一个作用域里冲突：资源管理器的 Ctrl+F 与编辑器的 Ctrl+F 互不影响。
const scopes = new Map(SHORTCUT_ITEMS.map((item) => [item.id, item.scope]))

const clashes = computed(() => {
  const groups = new Map()
  for (const [id, value] of Object.entries(draft.value)) {
    if (!value) continue
    const list = groups.get(value) || []
    list.push({ id, scope: scopes.get(id) || 'any' })
    groups.set(value, list)
  }
  const hit = new Set()
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]
        const b = list[j]
        if (a.scope === b.scope || a.scope === 'any' || b.scope === 'any') {
          hit.add(a.id)
          hit.add(b.id)
        }
      }
    }
  }
  return hit
})

// 每次改完整组写进草稿；保存由弹窗统一提交。
function update(next) {
  draft.value = next
  settings.set('shortcuts', { ...next })
}

watch(
  () => settings.get('shortcuts'),
  (value) => {
    draft.value = { ...SHORTCUT_DEFAULTS, ...(value || {}) }
  },
)

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
    update({ ...draft.value, [recording.value]: '' })
    stopRecord()
    return
  }
  const value = bindingFromEvent(event)
  if (!value) return
  update({ ...draft.value, [recording.value]: value })
  stopRecord()
}

onBeforeUnmount(stopRecord)
</script>

<style scoped>
.group + .group {
  margin-top: 10px;
}
.group-title {
  margin: 0 0 4px;
  font-size: 0.76rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
}
.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
}
.name {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface));
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
.clash-tip {
  margin: 8px 0 0;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-error));
}
</style>
