<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:01:03
 * @FilePath: \idex\web\src\features\settings\components\sections\SearchSettings.vue
 * @Description: 搜索设置：跳过目录的名单，读写服务端设置。
-->
<template>
  <h3 class="pane-title">搜索</h3>
  <div class="field">
    <div class="field-head">
      <span class="field-label">跳过的目录</span>
      <v-btn size="x-small" variant="text" @click="fillDefaults">填入默认</v-btn>
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

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'

const text = ref('')
const defaults = ref([])

async function load() {
  const data = await api.settings()
  defaults.value = data.defaults || []
  text.value = (data.search_ignore || []).join('\n')
}

function fillDefaults() {
  text.value = defaults.value.join('\n')
}

async function save() {
  const names = text.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  try {
    const data = await api.saveSettings(names)
    text.value = (data.search_ignore || []).join('\n')
    return true
  } catch (err) {
    toast(`保存设置失败：${err.message}`, 'error')
    return false
  }
}

onMounted(load)

defineExpose({ save })
</script>

<style scoped>
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
</style>
