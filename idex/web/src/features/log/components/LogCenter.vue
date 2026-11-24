<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:28:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\features\log\components\LogCenter.vue
 * @Description: 顶栏日志入口：服务端持久化的错误、告警与正常日志，分页查看与清空。
-->
<template>
  <v-menu
    v-if="total"
    v-model="open"
    location="bottom end"
    :close-on-content-click="false"
    width="480"
  >
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" icon variant="text" :title="`${total} 条日志`">
        <v-badge :content="total" :color="badgeColor">
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
        <v-btn size="small" variant="text" :disabled="!total" @click="clearAll">清空</v-btn>
      </div>

      <div class="list">
        <p v-if="error" class="none bad">{{ error }}</p>
        <p v-else-if="loading && !items.length" class="none">正在读取…</p>
        <p v-else-if="!items.length" class="none">没有{{ levelText }}。</p>
        <div
          v-for="entry in items"
          :key="entry.id"
          class="item"
          @click="toggle(entry.id)"
        >
          <v-icon size="16" :color="colorOf(entry.level)">
            {{ iconOf(entry.level) }}
          </v-icon>
          <div class="body">
            <div class="line">
              <span class="time">{{ timeOf(entry.at) }}</span>
              <span class="msg" :class="{ expanded: opened.has(entry.id) }">{{ entry.message }}</span>
            </div>
            <template v-if="opened.has(entry.id)">
              <pre v-if="entry.detail" class="detail">{{ entry.detail }}</pre>
              <div class="detail-actions">
                <span class="source">{{ entry.source }}</span>
                <v-spacer />
                <v-btn size="x-small" variant="text" @click.stop="copyEntry(entry)">复制</v-btn>
              </div>
            </template>
          </div>
        </div>
        <div v-if="hasMore" class="more">
          <v-btn size="small" variant="text" color="primary" :loading="loading" @click="more">
            加载更多
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { copyText } from '@bash-scripts/web-shared'
import { useLogs } from '../composables/useLogs'
import { toast } from '../../../utils/notice'

const { items, counts, total, hasMore, loading, error, level, load, more, clear, startPolling } =
  useLogs()

const open = ref(false)
const opened = reactive(new Set())

const badgeColor = computed(() => {
  if (counts.error) return 'failed'
  if (counts.warning) return 'warning'
  return 'primary'
})

const filters = computed(() => [
  { value: 'all', title: '全部', count: total.value },
  { value: 'error', title: '错误', count: counts.error },
  { value: 'warning', title: '告警', count: counts.warning },
  { value: 'info', title: '正常', count: counts.info },
])

const LEVEL_STYLE = {
  error: { icon: 'mdi-alert-circle-outline', color: 'failed' },
  warning: { icon: 'mdi-alert-outline', color: 'warning' },
  info: { icon: 'mdi-information-outline', color: 'info' },
}

const levelText = computed(
  () => ({ error: '错误', warning: '告警', info: '正常日志' })[level.value] || '日志',
)

function iconOf(itemLevel) {
  return (LEVEL_STYLE[itemLevel] || LEVEL_STYLE.info).icon
}

function colorOf(itemLevel) {
  return (LEVEL_STYLE[itemLevel] || LEVEL_STYLE.info).color
}

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

async function clearAll() {
  await clear()
  opened.clear()
}

watch(open, (on) => {
  if (on) load()
})

onMounted(() => {
  load()
  startPolling()
})
</script>

<style scoped>
.card {
  max-height: 560px;
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
.none.bad {
  color: rgb(var(--v-theme-failed));
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
  max-height: 220px;
  overflow: auto;
  font-size: 0.72rem;
  white-space: pre-wrap;
  word-break: break-all;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 6px;
}
.detail-actions {
  display: flex;
  align-items: center;
  margin-top: 2px;
}
.source {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.more {
  display: flex;
  justify-content: center;
  padding: 6px 0;
}
</style>
