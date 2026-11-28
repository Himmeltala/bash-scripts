<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\features\settings\components\sections\LspSettings.vue
 * @Description: 语言服务器设置：逐项列出可用性、命令与缺失时的安装提示。
-->
<template>
  <p class="lead">关掉的服务器切到对应文件时也不会启动；改动点下面的「保存」生效。</p>
  <SettingsItem
    v-for="item in servers"
    :key="item.id"
    :label="item.title"
    :hint="hintOf(item)"
  >
    <template #action>
      <div class="acts">
        <v-chip
          size="x-small"
          variant="flat"
          :color="closed(item.id) ? 'grey' : item.supported === false ? 'warning' : item.available ? 'success' : 'error'"
        >
          {{ closed(item.id) ? '已关闭' : item.supported === false ? '暂不支持' : item.available ? '可用' : '没装' }}
        </v-chip>
        <v-switch
          :model-value="!closed(item.id)"
          color="primary"
          density="compact"
          hide-details
          inset
          :title="closed(item.id) ? '启动' : '关闭'"
          @update:model-value="(on) => setEnabled(item.id, on)"
        />
      </div>
    </template>
    <div class="mono cmd">{{ item.command }}</div>
  </SettingsItem>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../../../../utils/api'
import { useSettingsStore } from '../../../../stores/settings'
import { toast } from '../../../../utils/notice'
import { capabilityText } from '../../../engines/lib/capabilities'
import SettingsItem from '../SettingsItem.vue'

const settings = useSettingsStore()
const servers = ref([])
const disabled = computed(() => (settings.get('lsp.disabled') || []))

function closed(id) {
  return disabled.value.includes(id)
}

function setEnabled(id, on) {
  const rest = disabled.value.filter((key) => key !== id)
  settings.set('lsp.disabled', on ? rest : [...rest, id])
}

async function load() {
  try {
    const data = await api.lspStatus()
    servers.value = data.servers || []
  } catch (err) {
    toast(`读取语言服务器失败：${err.message}`, 'error')
  }
}

function hintOf(item) {
  if (closed(item.id)) return '已关闭，切到对应文件时不会启动'
  const parts = [capabilityText(item), item.available ? '' : item.hint].filter(Boolean)
  return parts.join('；')
}

onMounted(load)

defineExpose({ load })
</script>

<style scoped>
.lead {
  margin: 4px 0 6px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.acts {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cmd {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
  word-break: break-all;
}
</style>
