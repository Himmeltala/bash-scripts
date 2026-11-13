<script setup>
import { computed, ref } from 'vue'
import BrandIcon from './BrandIcon.vue'
import { data } from '../composables/useUsage'
import { COLUMNS, nf, SOURCE_LIST, cellValue } from '../composables/format'

const sortKey = ref('')
const sortDesc = ref(false)

const columns = computed(() => COLUMNS[data.value?.command || 'daily'] || COLUMNS.daily)

const rows = computed(() => {
  const list = [...(data.value?.rows || [])]
  const key = sortKey.value
  const column = columns.value.find((item) => item.key === key)
  if (!column) return list
  const sign = sortDesc.value ? -1 : 1
  return list.sort((a, b) => {
    if (column.num || column.money) return sign * ((Number(a[key]) || 0) - (Number(b[key]) || 0))
    return sign * String(a[key] || '').localeCompare(String(b[key] || ''), 'zh-CN')
  })
})

// v-data-table 的表头，排序交给它自己处理。列宽按内容给，不让表头里的两字词折行。
const WIDTH = {
  source: 92,
  origin: 68,
  date: 104,
  slot: 64,
  label: 72,
  session: 132,
  project: 120,
  start: 136,
  model: 132,
  api: 200,
}

const headers = computed(() =>
  columns.value.map((column) => ({
    title: column.label,
    key: column.key,
    align: column.num || column.money ? 'end' : 'start',
    sortable: true,
    width: WIDTH[column.key],
    nowrap: true,
  })),
)

// 合计行：非数字列留空，数字列逐列对齐，末格写「合计」。
const totals = computed(() => (data.value?.totals ? COLUMNS.totalsFor(data.value.command) : []))

const totalsRow = computed(() => data.value?.totals || {})

const sourceOf = (key) => SOURCE_LIST.find((item) => item.key === key)

// 表里的数字带千分位，跟卡片一致；合计行是右对齐的千分位串，宽度有限就留空让标题提示。
const cell = (column, row, blankMissing = false) => {
  const text = cellValue(column, row, blankMissing)
  return column.num ? nf.format(Math.round(Number(row[column.key]) || 0)) : text
}

function rowProps({ item }) {
  return item.origin === 'cache' ? { class: 'cached-row' } : {}
}
</script>

<template>
  <v-card variant="flat">
    <v-data-table
      :headers="headers"
      :items="rows"
      item-value="key"
      density="compact"
      hover
      :items-per-page="-1"
      hide-default-footer
      :sort-by="[{ key: sortKey, order: sortDesc ? 'desc' : 'asc' }]"
      :row-props="rowProps"
      @update:sort-by="(value) => { sortKey = value?.[0]?.key || ''; sortDesc = value?.[0]?.order === 'desc' }"
    >
      <template v-for="column in columns" :key="column.key" #[`item.${column.key}`]="{ item }">
        <span v-if="column.key === 'source'" class="source">
          <span class="mark" :title="sourceOf(item.source)?.name || item.source">
            <BrandIcon :name="item.source" :size="13" />
          </span>{{ cell(column, item) }}
        </span>
        <span v-else-if="column.key === 'origin'" :class="{ cached: item.origin === 'cache' }">
          {{ cell(column, item) }}
        </span>
        <span
          v-else
          :class="{ mono: column.mono, strong: column.strong }"
          :title="column.key === 'api' ? item.api : column.key === 'session' ? item.session : null"
        >
          {{ cell(column, item) }}
        </span>
      </template>

      <template #bottom>
        <div class="total-row">
          <div
            v-for="column in totals"
            :key="column.key"
            class="cell"
            :class="{ end: column.num || column.money, money: column.money }"
            :style="WIDTH[column.key] ? { flex: `0 0 ${WIDTH[column.key]}px`, width: `${WIDTH[column.key]}px` } : null"
          >
            {{ cell(column, totalsRow, true) }}
          </div>
        </div>
      </template>
    </v-data-table>
  </v-card>
</template>

<style scoped>
.source {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.mark {
  display: inline-grid;
  place-items: center;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 0.3rem;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.68rem;
  font-weight: 700;
}

.cached {
  color: rgb(var(--v-theme-primary));
}

.mono {
  font-family: inherit;
  font-size: 0.82rem;
}

.strong {
  font-weight: 700;
}

.total-row {
  display: flex;
  align-items: center;
  border-top: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
  font-weight: 700;
  font-size: 0.85rem;
}

.total-row .cell {
  flex: 1 1 0;
  padding: 0.45rem 0.75rem 0.45rem 0;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.total-row .end {
  text-align: right;
}

.total-row .money {
  font-size: 0.78rem;
}

:deep(.cached-row) {
  background: rgb(var(--v-theme-cached));
}
</style>
