<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\features\settings\components\sections\LspSettings.vue
 * @Description: 语言服务器设置：逐项列出可用性、命令与缺失时的安装提示。
-->
<template>
  <SettingsItem
    v-for="item in servers"
    :key="item.id"
    :label="item.title"
    :hint="hintOf(item)"
  >
    <template #action>
      <v-chip
        size="x-small"
        variant="flat"
        :color="item.supported === false ? 'warning' : item.available ? 'success' : 'error'"
      >
        {{ item.supported === false ? '暂不支持' : item.available ? '可用' : '没装' }}
      </v-chip>
    </template>
    <div class="mono cmd">{{ item.command }}</div>
  </SettingsItem>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import { capabilityText } from '../../../engines/lib/capabilities'
import SettingsItem from '../SettingsItem.vue'

const servers = ref([])

async function load() {
  try {
    const data = await api.lspStatus()
    servers.value = data.servers || []
  } catch (err) {
    toast(`读取语言服务器失败：${err.message}`, 'error')
  }
}

function hintOf(item) {
  const parts = [capabilityText(item), item.available ? '' : item.hint].filter(Boolean)
  return parts.join('；')
}

onMounted(load)

defineExpose({ load })
</script>

<style scoped>
.cmd {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
  word-break: break-all;
}
</style>
