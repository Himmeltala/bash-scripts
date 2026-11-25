<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 08:21:53
 * @FilePath: \idex\web\src\features\settings\components\sections\SearchSettings.vue
 * @Description: 搜索设置：跳过目录的名单，读写服务端设置。
-->
<template>
  <SettingsItem
    label="跳过的目录"
    hint="一行一个目录名，按名字匹配任意层级；留空则不跳过。"
  >
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
  </SettingsItem>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import SettingsItem from '../SettingsItem.vue'

const text = ref('')
const defaults = ref([])

async function load() {
  const data = await api.settings()
  defaults.value = (data.defaults && data.defaults.search_ignore) || []
  text.value = (data.search_ignore || []).join('\n')
}

function reset() {
  text.value = defaults.value.join('\n')
}

async function save() {
  const names = text.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  try {
    const data = await api.saveSettings({ search_ignore: names })
    text.value = (data.search_ignore || []).join('\n')
    return true
  } catch (err) {
    toast(`保存设置失败：${err.message}`, 'error')
    return false
  }
}

onMounted(load)

defineExpose({ save, reset })
</script>
