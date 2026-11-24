<!--
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:19:43
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:01:03
 * @FilePath: \idex\web\src\features\settings\components\SettingsDialog.vue
 * @Description: 设置外壳：左侧按登记表列分类，右侧按需加载对应 section，保存交给 section 自己。
-->
<template>
  <FloatingDialog
    v-model="open"
    storage-key="idex-settings"
    :initial-width="780"
    :initial-height="600"
    :min-width="520"
    :min-height="420"
    persistent
  >
    <template #title>设置</template>

    <div class="layout">
      <nav class="nav">
        <button
          v-for="item in sections"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ active: section === item.id }"
          @click="section = item.id"
        >
          <v-icon size="16">{{ item.icon }}</v-icon>
          {{ item.title }}
        </button>
      </nav>

      <section class="pane">
        <component :is="current" :key="`${section}-${openSeq}`" ref="paneRef" />
      </section>
    </div>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="open = false">关闭</v-btn>
      <v-btn v-if="savable" color="primary" variant="flat" :loading="saving" @click="save">
        保存
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { toast } from '../../../utils/notice'
import { SETTINGS_SECTIONS } from '../lib/sections'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue', 'saved'])

const sections = SETTINGS_SECTIONS
const section = ref(sections[0].id)
const paneRef = ref(null)
const saving = ref(false)
const openSeq = ref(0)
const views = new Map(
  sections.map((item) => [item.id, defineAsyncComponent(item.load)]),
)

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const current = computed(() => views.get(section.value))
const savable = computed(() => {
  const hit = sections.find((item) => item.id === section.value)
  return !!(hit && hit.savable)
})

watch(
  () => props.modelValue,
  (on) => {
    // 每次打开都重挂当前 section，让它按最新的服务端数据自己读一遍。
    if (on) openSeq.value += 1
  },
)

async function save() {
  const pane = paneRef.value
  if (!pane || typeof pane.save !== 'function') {
    open.value = false
    return
  }
  saving.value = true
  try {
    const ok = await pane.save()
    if (ok === false) return
    emit('saved')
    open.value = false
  } catch (err) {
    toast(err.message || '保存失败', 'error')
  } finally {
    saving.value = false
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
  flex: 0 0 152px;
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
.pane {
  flex: 1 1 auto;
  min-width: 0;
  overflow: auto;
  padding: 4px 4px 4px 16px;
}
</style>
