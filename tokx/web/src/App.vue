<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { COMMANDS, EVERY, RANGES, SOURCES, view } from './composables/useView'
import { busy, data, error, load, loadedAt } from './composables/useUsage'
import SummaryCards from './components/SummaryCards.vue'
import UsageCharts from './components/UsageCharts.vue'
import UsageTable from './components/UsageTable.vue'

let timer = 0

const stamp = computed(() => {
  if (error.value) return `读取失败：${error.value}`
  if (!loadedAt.value) return '正在读取…'
  return `刷新于 ${loadedAt.value.replace('T', ' ')} · ${data.value?.timezone || ''}`
})

const notice = computed(() => {
  const models = data.value?.unpriced_models || []
  return models.length ? `这些模型没有价格，只算 token 不算钱：${models.join('、')}` : ''
})

const hiddenCount = computed(() => (data.value ? data.value.rows.length : 0))

function reload() {
  view.sort = { key: '', desc: true }
  load()
}

function schedule() {
  clearInterval(timer)
  if (!view.every) return
  timer = setInterval(() => {
    if (!document.hidden) load()
  }, view.every * 1000)
}

watch(() => view.every, schedule)
watch(() => [view.command, view.range, view.since, view.until, view.sources.join(',')], reload)

function onVisible() {
  if (!document.hidden) load()
}

onMounted(() => {
  schedule()
  document.addEventListener('visibilitychange', onVisible)
  load()
})

onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <header>
    <div class="bar">
      <h1>tokx 用量</h1>
      <span class="stamp">{{ stamp }}</span>
      <span class="grow"></span>
      <button type="button" :disabled="busy" title="立刻刷新一次" @click="load">刷新</button>
    </div>
    <div class="bar">
      <label>
        报表
        <select v-model="view.command">
          <option v-for="item in COMMANDS" :key="item.key" :value="item.key">{{ item.name }}</option>
        </select>
      </label>
      <label>
        范围
        <select v-model="view.range">
          <option v-for="item in RANGES" :key="item.key" :value="item.key">{{ item.name }}</option>
        </select>
      </label>
      <span v-if="view.range === 'custom'" class="sources">
        <input v-model="view.since" type="date" aria-label="起始日期" />
        <span>至</span>
        <input v-model="view.until" type="date" aria-label="结束日期" />
      </span>
      <span class="sources">
        <label v-for="item in SOURCES" :key="item.key">
          <input v-model="view.sources" type="checkbox" :value="item.key" />
          {{ item.name }}
        </label>
      </span>
      <span class="grow"></span>
      <label>
        自动刷新
        <select v-model.number="view.every">
          <option v-for="value in EVERY" :key="value" :value="value">{{ value ? `${value} 秒` : '关闭' }}</option>
        </select>
      </label>
    </div>
  </header>

  <main>
    <SummaryCards />
    <p v-if="notice" class="notice">{{ notice }}</p>
    <UsageCharts v-if="hiddenCount" />
    <UsageTable />
    <p class="hint">点表头排序，再点一次反向。出处标成「缓存」的是会话文件已删除、数字从账本读回来的行。</p>
  </main>
</template>
