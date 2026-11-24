<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:01:03
 * @FilePath: \idex\web\src\features\settings\components\sections\LspSettings.vue
 * @Description: 语言服务器设置：列出各语言的可用性与安装命令，只读。
-->
<template>
  <div class="field-head">
    <h3 class="pane-title">语言服务器</h3>
    <v-btn size="x-small" variant="text" :loading="loading" @click="load">刷新</v-btn>
  </div>
  <p class="hint">
    浏览页里 Ctrl+点击标识符跳定义靠这些服务器；没装的语言点了会提示安装命令。
  </p>
  <div v-for="item in servers" :key="item.id" class="lsp-row">
    <div class="lsp-main">
      <div class="lsp-title">
        {{ item.title }}
        <v-chip
          size="x-small"
          variant="flat"
          :color="item.supported === false ? 'warning' : item.available ? 'success' : 'error'"
        >
          {{ item.supported === false ? '暂不支持' : item.available ? '可用' : '没装' }}
        </v-chip>
      </div>
      <div class="mono lsp-cmd">{{ item.command }}</div>
      <div v-if="capabilityText(item)" class="hint">{{ capabilityText(item) }}</div>
      <div v-if="!item.available" class="hint">{{ item.hint }}</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import { capabilityText } from '../../../engines/lib/capabilities'

const servers = ref([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await api.lspStatus()
    servers.value = data.servers || []
  } catch (err) {
    toast(`读取语言服务器失败：${err.message}`, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(load)

defineExpose({ load })
</script>

<style scoped>
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pane-title {
  margin: 0 0 12px;
  font-size: 0.95rem;
}
.hint {
  margin: 0;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.lsp-row {
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.lsp-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lsp-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  font-weight: 500;
}
.lsp-cmd {
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
