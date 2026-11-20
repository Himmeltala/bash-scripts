<script setup>
import { computed, ref, watch } from 'vue'
import BrandIcon from '../../../components/BrandIcon.vue'
import { data } from '../composables/useUsage'
import { formatNumber } from '@bash-scripts/web-shared/format'
import { COLUMNS, SOURCE_LIST, cellValue } from '../composables/format'

// 排序记在本地：刷新或切走再回来时保持上次排的列与方向，每张报表各记一份。
const SORT_PREFIX = 'llmx.table-sort.'

function loadSort(command) {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_PREFIX + command) || 'null')
    if (saved && typeof saved.key === 'string') return saved
  } catch (err) {
    // 存的内容坏了就当没存过，不耽误出表。
  }
  return { key: '', desc: false }
}

function saveSort(command, key, desc) {
  try {
    localStorage.setItem(SORT_PREFIX + command, JSON.stringify({ key, desc }))
  } catch (err) {
    // 存不进去只影响下次恢复，当前这次排序照常。
  }
}

const command = computed(() => data.value?.command || 'daily')
const initial = loadSort(command.value)
const sortKey = ref(initial.key)
const sortDesc = ref(initial.desc)

// 换报表时列不一样，取那张报表自己记住的排序。
watch(command, (name) => {
  const saved = loadSort(name)
  sortKey.value = saved.key
  sortDesc.value = saved.desc
})

watch([sortKey, sortDesc], () => saveSort(command.value, sortKey.value, sortDesc.value))

const columns = computed(() => COLUMNS[command.value] || COLUMNS.daily)

const rows = computed(() => {
  const list = [...(data.value?.rows || [])]
  const key = sortKey.value
  const column = columns.value.find((item) => item.key === key)
  if (!column) return list
  const sign = sortDesc.value ? -1 : 1
  return list.sort((a, b) => {
    if (column.num || column.money || column.percent || column.seconds) {
      return sign * ((Number(a[key]) || 0) - (Number(b[key]) || 0))
    }
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
  session: 124,
  project: 140,
  start: 136,
  model: 132,
  api: 240,
  cache_hit: 88,
  cache_saved: 104,
}

// 表头一律居中；正文单元格用 cell-props 统一靠右，标题和数值都贴着右边界。
const headers = computed(() =>
  columns.value.map((column) => ({
    title: column.label,
    key: column.key,
    align: 'center',
    sortable: true,
    width: WIDTH[column.key],
    nowrap: true,
  })),
)

const cellProps = () => ({ class: 'text-end' })

// 异常值标红：缓存命中低于 99%、请求数超过 1500、总 token 超过 3 亿、合计费用超过 30。
// 只标明细行，合计行不着色。
function alertCell(column, row) {
  const raw = row[column.key]
  if (raw == null || raw === '') return false
  const value = Number(raw)
  if (!Number.isFinite(value)) return false
  if (column.key === 'cache_hit') return value < 0.99
  if (column.key === 'requests') return value > 1500
  if (column.key === 'total_tokens') return value > 300000000
  if (column.key === 'cost') return value > 30
  return false
}

const totalsRow = computed(() => data.value?.totals || {})

const sourceOf = (key) => SOURCE_LIST.find((item) => item.key === key)

// 表里的数字带千分位，跟卡片一致；合计行是右对齐的千分位串，宽度有限就留空让标题提示。
const cell = (column, row, blankMissing = false) => {
  const text = cellValue(column, row, blankMissing)
  return column.num ? formatNumber(row[column.key]) : text
}

function rowProps({ item }) {
  return item.origin === 'cache' ? { class: 'cached-row' } : {}
}
</script>

<template>
  <v-card variant="flat" class="table-card">
    <v-data-table
      :headers="headers"
      :items="rows"
      item-value="key"
      density="compact"
      hover
      fixed-header
      fixed-footer
      :items-per-page="-1"
      hide-default-footer
      :sort-by="[{ key: sortKey, order: sortDesc ? 'desc' : 'asc' }]"
      :row-props="rowProps"
      :cell-props="cellProps"
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
          :class="{ mono: column.mono, strong: column.strong, 'cell-alert': alertCell(column, item) }"
          :title="column.key === 'api' ? item.api : column.key === 'session' ? item.session : null"
        >
          {{ cell(column, item) }}
        </span>
      </template>

      <template #tfoot>
        <tr class="total-row">
          <td v-for="(column, index) in columns" :key="column.key" class="text-end">
            {{
              index === 0
                ? '合计'
                : column.num || column.money || column.percent
                  ? cell(column, totalsRow, true)
                  : ''
            }}
          </td>
        </tr>
      </template>
    </v-data-table>
  </v-card>
</template>

<style scoped>
/* 卡片跟着外层分配的高度走，表格在卡片内部滚动，合计行留在底部。 */
.table-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-card :deep(.v-data-table) {
  flex: 1 1 auto;
  min-height: 0;
}

/* 单元格左右留白收窄到 10px，十几列的表在 1920 宽的窗口里放得下，不用横向拖。 */
.table-card :deep(.v-data-table th),
.table-card :deep(.v-data-table td) {
  padding: 0 10px;
}

/* 单元格统一不折行、垂直居中，行高才不会有的两行、合计行一行。 */
.table-card :deep(.v-data-table td) {
  vertical-align: middle;
  white-space: nowrap;
}

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

.cell-alert {
  color: rgb(var(--v-theme-error));
}

/* 合计行按普通数据行的行高与字号排，避免吸底后比上面的行高出一截。 */
.total-row td {
  height: var(--v-table-row-height);
  padding: 0 10px;
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
  white-space: nowrap;
  /* Vuetify 的吸底背景选择器少了 wrapper 一层，不生效，这里自己补上。 */
  background: rgb(var(--v-theme-surface));
  box-shadow: inset 0 1px 0 rgba(var(--v-border-color), var(--v-border-opacity));
}

:deep(.cached-row) {
  background: rgb(var(--v-theme-cached));
}
</style>
