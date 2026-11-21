<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fmtMoney, fmtNum, fmtTokens } from '../usage/composables/format'
import { toast } from '../../composables/notice'

const range = ref('30')
const loading = ref(false)
const rows = ref([])

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ command: 'daily' })
    if (range.value === 'all') params.set('all', '1')
    else params.set('days', range.value)
    const response = await fetch(`/api/usage?${params.toString()}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`)
    rows.value = body.rows || []
  } catch (err) {
    toast(err.message, 'error')
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(range, load)

// 模型性价比：同一段范围里每个模型的请求数、token、费用与单位成本。
const models = computed(() => {
  const groups = new Map()
  for (const row of rows.value) {
    const name = row.model || '未知'
    const group = groups.get(name) || {
      model: name,
      requests: 0,
      tokens: 0,
      cost: 0,
      input: 0,
      cache_read: 0,
    }
    group.requests += Number(row.requests) || 0
    group.tokens += Number(row.total_tokens) || 0
    group.cost += Number(row.cost) || 0
    group.input += Number(row.input) || 0
    group.cache_read += Number(row.cache_read) || 0
    groups.set(name, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      perRequest: group.requests ? group.cost / group.requests : null,
      perKToken: group.tokens ? (group.cost / group.tokens) * 1000 : null,
      hit: group.input + group.cache_read ? group.cache_read / (group.input + group.cache_read) : null,
    }))
    .sort((a, b) => b.cost - a.cost)
})

// 缓存写入收益：写入花掉的钱与命中省下的钱对比，回收为负说明写得太多。
const cacheRoi = computed(() => {
  const groups = new Map()
  for (const row of rows.value) {
    const name = row.model || '未知'
    const group = groups.get(name) || { model: name, write: 0, writeCost: 0, saved: 0 }
    group.write += Number(row.cache_write) || 0
    group.writeCost += Number(row.cost_cache_write) || 0
    group.saved += Number(row.cache_saved) || 0
    groups.set(name, group)
  }
  return [...groups.values()]
    .filter((group) => group.write > 0)
    .map((group) => ({ ...group, net: group.saved - group.writeCost }))
    .sort((a, b) => a.net - b.net)
})

// 异常日：与这段时间的日中位数比，超过两倍且不是零头的日子。
const anomalies = computed(() => {
  const daily = new Map()
  for (const row of rows.value) {
    const date = String(row.date || '')
    daily.set(date, (daily.get(date) || 0) + (Number(row.cost) || 0))
  }
  const values = [...daily.values()].filter((value) => value > 0).sort((a, b) => a - b)
  if (values.length < 4) return []
  const median = values[Math.floor((values.length - 1) / 2)]
  const threshold = Math.max(median * 2, 0.01)
  return [...daily.entries()]
    .filter(([, cost]) => cost > threshold)
    .map(([date, cost]) => ({ date, cost, ratio: median ? cost / median : null }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8)
})

const modelHeaders = [
  { title: '模型', key: 'model' },
  { title: '请求', key: 'requests', align: 'end' },
  { title: '总 token', key: 'tokens', align: 'end' },
  { title: '合计', key: 'cost', align: 'end' },
  { title: '每请求', key: 'perRequest', align: 'end' },
  { title: '每千 token', key: 'perKToken', align: 'end' },
  { title: '缓存命中', key: 'hit', align: 'end' },
]

const roiHeaders = [
  { title: '模型', key: 'model' },
  { title: '缓存写入', key: 'write', align: 'end' },
  { title: '写入费用', key: 'writeCost', align: 'end' },
  { title: '命中省下', key: 'saved', align: 'end' },
  { title: '净收益', key: 'net', align: 'end' },
]

const anomalyHeaders = [
  { title: '日期', key: 'date' },
  { title: '费用', key: 'cost', align: 'end' },
  { title: '是中位数的', key: 'ratio', align: 'end' },
]

function modelCell(item, key) {
  if (key === 'requests') return fmtNum(item.requests)
  if (key === 'tokens') return fmtTokens(item.tokens)
  if (key === 'cost') return `¥${fmtMoney(item.cost)}`
  if (key === 'perRequest') return item.perRequest == null ? '-' : `¥${fmtMoney(item.perRequest)}`
  if (key === 'perKToken') return item.perKToken == null ? '-' : `¥${fmtMoney(item.perKToken)}`
  if (key === 'hit') return item.hit == null ? '-' : `${(item.hit * 100).toFixed(2)}%`
  return item[key]
}

function roiCell(item, key) {
  if (key === 'write') return fmtNum(item.write)
  if (key === 'writeCost') return `¥${fmtMoney(item.writeCost)}`
  if (key === 'saved') return `¥${fmtMoney(item.saved)}`
  if (key === 'net') return `¥${fmtMoney(item.net)}`
  return item[key]
}

function anomalyCell(item, key) {
  if (key === 'cost') return `¥${fmtMoney(item.cost)}`
  if (key === 'ratio') return item.ratio == null ? '-' : `${item.ratio.toFixed(1)} 倍`
  return item[key]
}
</script>

<template>
  <v-container fluid class="pa-2 page">
    <div class="filters">
      <v-select
        v-model="range"
        :items="[
          { value: '7', title: '近 7 天' },
          { value: '30', title: '近 30 天' },
          { value: 'all', title: '全部历史' },
        ]"
        item-title="title"
        item-value="value"
        label="范围"
        density="compact"
        variant="outlined"
        hide-details
        class="pick"
      />
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="load">刷新</v-btn>
    </div>

    <v-card variant="flat" class="block">
      <v-card-title>模型性价比</v-card-title>
      <v-data-table
        :headers="modelHeaders"
        :items="models"
        density="compact"
        :items-per-page="10"
        class="table"
      >
        <template v-for="column in modelHeaders" :key="column.key" #[`item.${column.key}`]="{ item }">
          {{ modelCell(item, column.key) }}
        </template>
      </v-data-table>
    </v-card>

    <v-card variant="flat" class="block">
      <v-card-title>缓存写入收益</v-card-title>
      <p class="hint">净收益为命中省下的钱减去写入费用；为负说明写缓存不划算。</p>
      <v-data-table
        v-if="cacheRoi.length"
        :headers="roiHeaders"
        :items="cacheRoi"
        density="compact"
        :items-per-page="10"
        class="table"
      >
        <template v-for="column in roiHeaders" :key="column.key" #[`item.${column.key}`]="{ item }">
          {{ roiCell(item, column.key) }}
        </template>
      </v-data-table>
      <p v-else class="hint">这段时间没有缓存写入。</p>
    </v-card>

    <v-card variant="flat" class="block">
      <v-card-title>异常花费日</v-card-title>
      <p class="hint">按日中位数对比，超过两倍且不是零头的日期列出来。</p>
      <v-data-table
        v-if="anomalies.length"
        :headers="anomalyHeaders"
        :items="anomalies"
        density="compact"
        :items-per-page="-1"
        hide-default-footer
        class="table"
      >
        <template v-for="column in anomalyHeaders" :key="column.key" #[`item.${column.key}`]="{ item }">
          {{ anomalyCell(item, column.key) }}
        </template>
      </v-data-table>
      <p v-else class="hint">没有明显异常的日期。</p>
    </v-card>
  </v-container>
</template>

<style scoped>
.page {
  height: calc(100vh - var(--v-layout-top));
  overflow: auto;
}
.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.pick {
  max-width: 180px;
}
.block {
  margin-bottom: 10px;
}
.block :deep(.v-card-title) {
  font-size: 0.95rem;
  padding-bottom: 4px;
}
.hint {
  margin: 0 16px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.table {
  background: transparent;
}
</style>
