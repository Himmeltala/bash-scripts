<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatDate, startOfWeek } from '@bash-scripts/web-shared/format'
import { budgets, refreshSpend } from '../usage/composables/useBudgets'
import { fmtMoney } from '../usage/composables/format'
import { toast } from '../../composables/notice'

const loading = ref(false)
const rows = ref([])
const draft = ref({ daily: 0, weekly: 0, monthly: 0, items: [] })

const KIND_ITEMS = [
  { value: 'model', title: '模型' },
  { value: 'project', title: '项目' },
  { value: 'api', title: 'API' },
]

function cloneBudgets() {
  return {
    daily: Number(budgets.value.daily) || 0,
    weekly: Number(budgets.value.weekly) || 0,
    monthly: Number(budgets.value.monthly) || 0,
    items: (budgets.value.items || []).map((item) => ({ ...item })),
  }
}

async function load() {
  loading.value = true
  try {
    const today = new Date()
    const params = new URLSearchParams({
      command: 'daily',
      since: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      until: formatDate(today),
    })
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

onMounted(() => {
  draft.value = cloneBudgets()
  load()
})

const totals = computed(() => {
  const today = formatDate(new Date())
  const weekStart = formatDate(startOfWeek(new Date()))
  let daily = 0
  let weekly = 0
  let monthly = 0
  for (const row of rows.value) {
    const cost = Number(row.cost) || 0
    const date = String(row.date || '')
    monthly += cost
    if (date >= weekStart) weekly += cost
    if (date === today) daily += cost
  }
  return { daily, weekly, monthly }
})

const totalRows = computed(() => [
  { key: 'daily', name: '每日', spent: totals.value.daily, limit: Number(draft.value.daily) || 0 },
  { key: 'weekly', name: '每周', spent: totals.value.weekly, limit: Number(draft.value.weekly) || 0 },
  { key: 'monthly', name: '每月', spent: totals.value.monthly, limit: Number(draft.value.monthly) || 0 },
])

function kindKey(kind) {
  if (kind === 'model') return 'model'
  if (kind === 'project') return 'project'
  return 'api'
}

function itemSpend(item) {
  const key = kindKey(item.kind)
  const wanted = String(item.name || '')
  let sum = 0
  for (const row of rows.value) {
    const value = String(row[key] || (item.kind === 'project' ? '未记录' : ''))
    if (value === wanted) sum += Number(row.cost) || 0
  }
  return sum
}

const nameOptions = computed(() => {
  const out = { model: new Set(), project: new Set(), api: new Set() }
  for (const row of rows.value) {
    if (row.model) out.model.add(row.model)
    if (row.project) out.project.add(row.project)
    if (row.api) out.api.add(row.api)
  }
  return {
    model: [...out.model].sort(),
    project: [...out.project].sort(),
    api: [...out.api].sort(),
  }
})

function addItem() {
  draft.value.items.push({ kind: 'model', name: '', limit: 0 })
}

function removeItem(index) {
  draft.value.items.splice(index, 1)
}

function save() {
  budgets.value = {
    daily: Math.max(0, Number(draft.value.daily) || 0),
    weekly: Math.max(0, Number(draft.value.weekly) || 0),
    monthly: Math.max(0, Number(draft.value.monthly) || 0),
    items: draft.value.items
      .map((item) => ({
        kind: item.kind,
        name: String(item.name || '').trim(),
        limit: Math.max(0, Number(item.limit) || 0),
      }))
      .filter((item) => item.name && item.limit > 0),
  }
  toast('预算已保存', 'primary')
  refreshSpend()
}

function tone(spent, limit) {
  if (!limit) return ''
  const ratio = spent / limit
  if (ratio >= 1) return 'bad'
  if (ratio >= 0.8) return 'warn'
  return ''
}
</script>

<template>
  <v-container fluid class="pa-2 page">
    <p class="hint">预算存在浏览器里，花费按本月日报聚合。0 表示不设上限。</p>

    <v-card variant="flat" class="block">
      <v-card-title>总预算</v-card-title>
      <v-card-text>
        <div class="totals">
          <v-text-field
            v-model.number="draft.daily"
            type="number"
            min="0"
            label="每日上限（元）"
            density="compact"
            variant="outlined"
          />
          <v-text-field
            v-model.number="draft.weekly"
            type="number"
            min="0"
            label="每周上限（元）"
            density="compact"
            variant="outlined"
          />
          <v-text-field
            v-model.number="draft.monthly"
            type="number"
            min="0"
            label="每月上限（元）"
            density="compact"
            variant="outlined"
          />
        </div>
        <v-table density="compact" class="table">
          <thead>
            <tr>
              <th>周期</th>
              <th class="num">已花</th>
              <th class="num">上限</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in totalRows" :key="item.key">
              <td>{{ item.name }}</td>
              <td class="num">¥{{ fmtMoney(item.spent) }}</td>
              <td class="num">{{ item.limit ? `¥${fmtMoney(item.limit)}` : '不设' }}</td>
              <td :class="tone(item.spent, item.limit)">
                {{ item.limit ? `${((item.spent / item.limit) * 100).toFixed(1)}%` : '-' }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <v-card variant="flat" class="block">
      <v-card-title class="items-head">
        分项预算
        <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="addItem">添加</v-btn>
      </v-card-title>
      <v-card-text>
        <p class="hint">按模型、项目或 API 各设一个月度上限。</p>
        <div v-if="!draft.items.length" class="hint">还没有分项预算。</div>
        <div v-for="(item, index) in draft.items" :key="index" class="item-row">
          <v-select
            v-model="item.kind"
            :items="KIND_ITEMS"
            item-title="title"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="kind"
          />
          <v-combobox
            v-model="item.name"
            :items="nameOptions[item.kind] || []"
            label="名称"
            density="compact"
            variant="outlined"
            hide-details
            class="name"
          />
          <v-text-field
            v-model.number="item.limit"
            type="number"
            min="0"
            label="月度上限（元）"
            density="compact"
            variant="outlined"
            hide-details
            class="limit"
          />
          <span class="spent" :class="tone(itemSpend(item), Number(item.limit) || 0)">
            ¥{{ fmtMoney(itemSpend(item)) }}
          </span>
          <v-btn icon="mdi-delete-outline" size="small" variant="text" @click="removeItem(index)" />
        </div>
      </v-card-text>
    </v-card>

    <div class="actions">
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        @click="save"
      >
        保存
      </v-btn>
      <v-btn variant="text" :loading="loading" @click="load">刷新花费</v-btn>
    </div>
  </v-container>
</template>

<style scoped>
.page {
  height: calc(100vh - var(--v-layout-top));
  overflow: auto;
}
.block {
  margin-bottom: 10px;
}
.block :deep(.v-card-title) {
  font-size: 0.95rem;
  padding-bottom: 4px;
}
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 8px;
}
.items-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.item-row {
  display: grid;
  grid-template-columns: 100px minmax(160px, 1fr) 150px 110px 40px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.spent {
  text-align: right;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
.spent.warn {
  color: rgb(var(--v-theme-peak));
}
.spent.bad {
  color: rgb(var(--v-theme-error));
}
.actions {
  display: flex;
  gap: 8px;
}
.hint {
  margin: 0 0 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.hint.good {
  color: rgb(var(--v-theme-success));
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.table {
  background: transparent;
}
</style>
