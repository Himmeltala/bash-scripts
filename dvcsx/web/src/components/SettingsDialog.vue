<!--
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:19:43
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 23:30:00
 * @FilePath: \dvcsx\web\src\components\SettingsDialog.vue
 * @Description: 全局设置：左侧分类、右侧设置项，现在只有搜索一项。
-->
<template>
  <FloatingDialog
    v-model="open"
    storage-key="dvcsx-settings"
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
        <template v-if="section === 'search'">
          <h3 class="pane-title">搜索</h3>
          <div class="field">
            <div class="field-head">
              <span class="field-label">跳过的目录</span>
              <v-btn size="x-small" variant="text" :disabled="busy" @click="fillDefaults">
                填入默认
              </v-btn>
            </div>
            <p class="hint">
              一行一个，只写目录名，按名字在工作副本里任何一层匹配；存空就是不跳过任何目录。
            </p>
            <v-textarea
              v-model="text"
              variant="outlined"
              density="compact"
              rows="6"
              auto-grow
              spellcheck="false"
              hide-details
              placeholder="node_modules"
            />
            <p v-if="defaults.length" class="hint">默认：{{ defaults.join('、') }}</p>
          </div>
        </template>
        <p v-if="error" class="err">{{ error }}</p>
      </section>
    </div>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="busy" @click="open = false">取消</v-btn>
      <v-btn color="primary" variant="flat" :loading="busy" @click="save">保存</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { api } from '../composables/useApi'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue', 'saved'])

// 设置分类：以后加项就加一条，右边按 id 出对应的块。
const sections = [{ id: 'search', title: '搜索', icon: 'mdi-magnify' }]
const section = ref('search')

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const text = ref('')
const defaults = ref([])
const error = ref('')
const busy = ref(false)

// 每次打开都从服务端读一份：名单是全局的，别的浏览器改过这里也能看到。
watch(
  () => props.modelValue,
  async (on) => {
    if (!on) return
    error.value = ''
    busy.value = false
    try {
      const data = await api.settings()
      defaults.value = data.defaults || []
      text.value = (data.search_ignore || []).join('\n')
    } catch (err) {
      error.value = err.message
    }
  }
)

function fillDefaults() {
  text.value = defaults.value.join('\n')
}

async function save() {
  busy.value = true
  error.value = ''
  try {
    const names = text.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const data = await api.saveSettings(names)
    text.value = (data.search_ignore || []).join('\n')
    emit('saved', data)
    open.value = false
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
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
.pane-title {
  margin: 0 0 12px;
  font-size: 0.95rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.field-label {
  font-size: 0.84rem;
  font-weight: 500;
}
.hint {
  margin: 0;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.err {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-error));
}
</style>
