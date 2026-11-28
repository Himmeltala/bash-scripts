<!--
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:19:43
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:40:00
 * @FilePath: \idex\web\src\features\settings\components\SettingsDialog.vue
 * @Description: 设置外壳：分类来自后端登记表，右侧按类型生成行，搜索、脏标记与保存都由 store 承担。
-->
<template>
  <FloatingDialog
    v-model="open"
    storage-key="idex-settings"
    :initial-width="900"
    :initial-height="640"
    :min-width="620"
    :min-height="440"
    persistent
  >
    <template #title>设置</template>

    <div class="layout">
      <nav class="nav">
        <button
          v-for="group in navGroups"
          :key="group.title"
          type="button"
          class="nav-item"
          :class="{ active: !searching && activeGroup === group.title }"
          @click="pickGroup(group.title)"
        >
          <v-icon size="16">{{ groupIcon(group.title) }}</v-icon>
          <span class="nav-text">{{ group.title }}</span>
          <span v-if="group.dirty" class="dot" title="这一类有未保存的修改" />
        </button>
        <template v-if="!searching">
          <button
            v-for="item in DIAGNOSTIC_SECTIONS"
            :key="item.id"
            type="button"
            class="nav-item"
            :class="{ active: activeGroup === item.id }"
            @click="activeGroup = item.id"
          >
            <v-icon size="16">{{ item.icon }}</v-icon>
            <span class="nav-text">{{ item.title }}</span>
          </button>
        </template>
      </nav>

      <section class="pane">
        <div class="toolbar">
          <v-text-field
            v-model="query"
            density="compact"
            variant="outlined"
            hide-details
            placeholder="搜索设置（标题、说明或键名）"
            prepend-inner-icon="mdi-magnify"
            clearable
            class="search"
          />
          <v-switch
            v-model="onlyModified"
            label="只看已修改"
            color="primary"
            density="compact"
            hide-details
            inset
          />
        </div>

        <div class="list">
          <div v-if="showDiagnostics" class="diagnostics">
            <component :is="diagnosticsView" />
          </div>

          <template v-else>
            <div v-if="!visibleGroups.length" class="empty">没有匹配的设置。</div>
            <div v-for="group in visibleGroups" :key="group.title" class="group">
              <p v-if="searching || visibleGroups.length > 1" class="group-title">{{ group.title }}</p>
              <template v-for="(item, index) in group.items" :key="item.key">
                <p
                  v-if="item.section && (index === 0 || group.items[index - 1].section !== item.section)"
                  class="section-title"
                >
                  {{ item.section }}
                </p>
                <SettingsRow :item="item" />
              </template>
            </div>
          </template>
        </div>
      </section>
    </div>

    <template #actions>
      <v-btn variant="text" :disabled="!settings.dirtyCount" @click="settings.discard()">
        撤销修改
      </v-btn>
      <v-btn variant="text" :disabled="!settings.dirtyCount" @click="resetAll">
        恢复默认
      </v-btn>
      <v-spacer />
      <v-btn variant="text" @click="open = false">关闭</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="settings.saving"
        :disabled="!settings.dirtyCount"
        @click="save"
      >
        保存<span v-if="settings.dirtyCount">（{{ settings.dirtyCount }}）</span>
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { toast } from '../../../utils/notice'
import { useSettingsStore } from '../../../stores/settings'
import { DIAGNOSTIC_SECTIONS, groupIcon } from '../lib/sections'
import { filterSettings, groupModified, groupSettings } from '../lib/settingsView'
import SettingsRow from './SettingsRow.vue'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue', 'saved'])

const settings = useSettingsStore()
const query = ref('')
const onlyModified = ref(false)
const activeGroup = ref('')

const diagnostics = DIAGNOSTIC_SECTIONS.map((item) => ({
  ...item,
  view: defineAsyncComponent(item.load),
}))
const diagnosticsView = computed(() => diagnostics[0]?.view)

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dirtySet = computed(() => new Set(settings.dirtyKeys))
const searching = computed(() => !!query.value.trim() || onlyModified.value)

// 导航分类来自登记表；每类带一个「有修改」的小点。
const navGroups = computed(() =>
  groupSettings(settings.schema).map((group) => ({
    title: group.title,
    dirty: groupModified(group, dirtySet.value),
  })),
)

watch(
  navGroups,
  (groups) => {
    if (!activeGroup.value && groups.length) activeGroup.value = groups[0].title
    if (activeGroup.value && !groups.some((g) => g.title === activeGroup.value)) {
      activeGroup.value = groups[0]?.title || ''
    }
  },
  { immediate: true },
)

// 搜索或「只看已修改」时跨分类平铺；否则只显示当前分类。
const visibleGroups = computed(() => {
  const list = filterSettings(settings.schema, query.value, {
    dirty: dirtySet.value,
    onlyModified: onlyModified.value,
  })
  if (searching.value) return groupSettings(list)
  const one = list.filter((item) => (item.group || '其他') === activeGroup.value)
  return groupSettings(one)
})

const showDiagnostics = computed(() => !searching.value && activeGroup.value === 'lsp')

function pickGroup(title) {
  activeGroup.value = title
  if (searching.value) {
    query.value = ''
    onlyModified.value = false
  }
}

function resetAll() {
  for (const item of settings.schema) {
    if (JSON.stringify(settings.get(item.key)) !== JSON.stringify(item.default)) {
      settings.resetToDefault(item.key)
    }
  }
}

async function save() {
  try {
    await settings.save()
    toast('设置已保存', 'success')
    emit('saved')
    open.value = false
  } catch (err) {
    toast(`保存失败：${err.message}`, 'error')
  }
}
</script>

<style scoped>
.layout {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
.nav {
  flex: 0 0 150px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px 4px 0;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}
.nav-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.nav-item.active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.nav-text {
  flex: 1 1 auto;
}
.dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
.pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 4px 0 16px;
}
.toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 2px 4px 8px 0;
}
.search {
  flex: 1 1 auto;
  max-width: 380px;
}
.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
}
.diagnostics,
.group {
  min-width: 0;
}
.group + .group {
  margin-top: 6px;
}
.group-title {
  margin: 10px 0 2px;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
}
.section-title {
  margin: 12px 0 0;
  padding-left: 10px;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.empty {
  padding: 40px 0;
  text-align: center;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
