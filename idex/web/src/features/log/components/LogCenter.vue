<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:28:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\log\components\LogCenter.vue
 * @Description: Dock 里的日志入口：显示数量徽标，点击呼出日志面板。
-->
<template>
  <DockItem
    label="日志"
    icon="mdi-alert-circle-outline"
    :badge="store.total || null"
    :badge-color="badgeColor"
    @click="$emit('open')"
  />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAppLogsStore } from '../../../stores/appLogs'
import DockItem from '../../dock/components/DockItem.vue'

defineEmits(['open'])

const store = useAppLogsStore()
const badgeColor = computed(() => {
  if (store.counts.error) return 'failed'
  if (store.counts.warning) return 'warning'
  return 'primary'
})

onMounted(store.ensure)
</script>
