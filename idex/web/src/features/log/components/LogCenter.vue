<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:28:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:28:38
 * @FilePath: \idex\web\src\features\log\components\LogCenter.vue
 * @Description: 顶栏的错误与告警入口：数量徽标、按级别筛选、展开查看详情与清空记录。
-->
<template>
  <v-menu v-if="items.length" v-model="open" location="bottom end" :close-on-content-click="false" width="460">
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" icon variant="text" :title="`${items.length} 条错误与告警`">
        <v-badge :content="items.length" :color="items[0].level === 'error' ? 'failed' : 'warning'">
          <v-icon>mdi-alert-circle-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>

    <v-card class="card">
      <div class="head">
        <span class="title">日志</span>
        <v-chip
          v-for="item in filters"
          :key="item.value"
          size="x-small"
          :variant="level === item.value ? 'flat' : 'text'"
          :color="level === item.value ? 'primary' : undefined"
          @click="level = item.value"
        >
          {{ item.title }} {{ item.count }}
        </v-chip>
        <v-spacer />
        <v-btn size="small" variant="text" :disabled="!items.length" @click="clearAll">清空</v-btn>
      </div>

      <div class="list">
        <p v-if="!shown.length" class="none">没有{{ level === 'warning' ? '告警' : level === 'error' ? '错误' : '日志' }}。</p>
        <div
          v-for="entry in shown"
          :key="entry.id"
          class="item"
          @click="toggle(entry.id)"
        >
          <v-icon size="16" :color="entry.level === 'error' ? 'failed' : 'warning'">
            {{ entry.level === 'error' ? 'mdi-alert-circle-outline' : 'mdi-alert-outline' }}
          </v-icon>
          <div class="body">
            <div class="line">
              <span class="time">{{ timeOf(entry.at) }}</span>
              <span class="msg" :class="{ expanded: opened.has(entry.id) }">{{ entry.message }}</span>
            </div>
            <template v-if="opened.has(entry.id)">
              <pre v-if="entry.detail" class="detail">{{ entry.detail }}</pre>
              <div class="detail-actions">
                <v-btn size="x-small" variant="text" @click.stop="copyEntry(entry)">复制</v-btn>
              </div>
            </template>
          </div>
        </div>
      </div>

      <p class="foot">最多保留最近 200 条，点击一条展开详情。</p>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { copyText } from '@bash-scripts/web-shared'
import { clearLogs, logs } from '../../../utils/logs'
import { toast } from '../../../utils/notice'

const open = ref(false)
const level = ref('all')
const opened = reactive(new Set())
const items = computed(() => logs.items)

const filters = computed(() => {
  const all = items.value
  return [
    { value: 'all', title: '全部', count: all.length },
    { value: 'error', title: '错误', count: all.filter((item) => item.level === 'error').length },
    { value: 'warning', title: '告警', count: all.filter((item) => item.level === 'warning').length },
  ]
})

const shown = computed(() =>
  level.value === 'all' ? items.value : items.value.filter((item) => item.level === level.value),
)

function timeOf(at) {
  const date = new Date(at)
  const two = (value) => String(value).padStart(2, '0')
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

function toggle(id) {
  if (opened.has(id)) opened.delete(id)
  else opened.add(id)
}

async function copyEntry(entry) {
  const text = entry.detail ? `${entry.message}\n\n${entry.detail}` : entry.message
  const ok = await copyText(text)
  if (ok) toast('已复制', 'primary')
}

function clearAll() {
  clearLogs()
  opened.clear()
}
</script>

<style scoped>
.card {
  max-height: 520px;
  display: flex;
  flex-direction: column;
}
.head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.title {
  font-weight: 600;
  margin-right: 4px;
}
.list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 60px;
}
.none {
  padding: 18px 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
}
.item {
  display: flex;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.body {
  min-width: 0;
  flex: 1 1 auto;
}
.line {
  display: flex;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
}
.time {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.msg {
  font-size: 0.8rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}
.msg.expanded {
  display: block;
}
.detail {
  margin: 6px 0 0;
  padding: 6px 8px;
  max-height: 200px;
  overflow: auto;
  font-size: 0.72rem;
  white-space: pre-wrap;
  word-break: break-all;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 6px;
}
.detail-actions {
  display: flex;
  justify-content: flex-end;
}
.foot {
  margin: 0;
  padding: 6px 10px;
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
</style>
