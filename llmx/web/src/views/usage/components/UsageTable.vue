<script setup>
import { computed, ref, watch } from 'vue'
import BrandIcon from '../../../components/BrandIcon.vue'
import { data } from '../composables/useUsage'
import { formatNumber } from '@bash-scripts/web-shared/format'
import { COLUMNS, SOURCE_LIST, cellValue } from '../lib/format'
import { tagOf } from '../composables/useSessionTags'
import SessionDetailDialog from './SessionDetailDialog.vue'

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

// 会话可以标为收藏或忽略；默认隐藏忽略的，也可以只看收藏的。
const showIgnored = ref(false)
const onlyStarred = ref(false)

const rows = computed(() => {
  let list = [...(data.value?.rows || [])]
  if (command.value === 'session') {
    list = list.filter((row) => {
      const tag = tagOf(row)
      return (!onlyStarred.value || tag.star) && (showIgnored.value || !tag.ignored)
    })
  }
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

// 表头与正文的居中统一由全局 table.css 负责，这里只管列与宽度。
const headers = computed(() =>
  columns.value.map((column) => ({
    title: column.label,
    key: column.key,
    sortable: true,
    width: WIDTH[column.key],
    nowrap: true,
  })),
)

// 缓存命中是固定口径；请求数、token 与费用随报表维度变化，按本报表内的分位取档：
// 75% 以下绿，75% 到 90% 黄，90% 以上红。每张报表各算各的，不会拿小时行去比日行。
const sourceRows = computed(() => data.value?.rows || [])

function quantile(sorted, ratio) {
  if (!sorted.length) return 0
  return sorted[Math.floor((sorted.length - 1) * ratio)]
}

const thresholds = computed(() => {
  const pair = (key) => {
    const values = sourceRows.value
      .map((row) => Number(row[key]))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)
    return [quantile(values, 0.75), quantile(values, 0.9)]
  }
  return {
    requests: pair('requests'),
    total_tokens: pair('total_tokens'),
    cost: pair('cost'),
  }
})

// 明细行的颜色口径；合计行不着色。
function cellTone(column, row) {
  const raw = row[column.key]
  if (raw == null || raw === '') return ''
  const value = Number(raw)
  if (!Number.isFinite(value)) return ''
  if (column.key === 'cache_hit') {
    if (value > 0.99) return 'cell-good'
    if (value < 0.99) return 'cell-alert'
    return ''
  }
  const range = thresholds.value[column.key]
  if (!range) return ''
  if (value <= range[0]) return 'cell-good'
  if (value <= range[1]) return 'cell-warn'
  return 'cell-alert'
}

const totalsRow = computed(() => data.value?.totals || {})

const sourceOf = (key) => SOURCE_LIST.find((item) => item.key === key)

// 表里的数字带千分位，跟卡片一致；合计行是居中的千分位串，宽度有限就留空让标题提示。
const cell = (column, row, blankMissing = false) => {
  const text = cellValue(column, row, blankMissing)
  return column.num ? formatNumber(row[column.key]) : text
}

// 会话报表点一行看这个会话的逐条请求；其他报表行没有这层明细。
const detailOn = ref(false)
const detailRow = ref(null)

function openDetail(item) {
  if (!item?.session) return
  detailRow.value = item
  detailOn.value = true
}

function rowProps({ item }) {
  const base = item.origin === 'cache' ? { class: 'cached-row' } : {}
  if (command.value !== 'session' || !item?.session) return base
  return {
    ...base,
    class: [base.class, 'click-row'],
    onClick: () => openDetail(item),
  }
}
</script>

<template>
  <v-card variant="flat" class="table-card">
    <div v-if="command === 'session'" class="table-tools">
      <v-checkbox
        v-model="onlyStarred"
        density="compact"
        hide-details
        label="只看收藏的会话"
      />
      <v-checkbox
        v-model="showIgnored"
        density="compact"
        hide-details
        label="显示已忽略的会话"
      />
    </div>
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
        <span v-else-if="column.key === 'session'" class="session-cell">
          <v-icon v-if="tagOf(item).star" size="14" color="primary" title="已收藏">mdi-star</v-icon>
          {{ cell(column, item) }}
        </span>
        <span
          v-else
          :class="[cellTone(column, item), { mono: column.mono, strong: column.strong }]"
          :title="column.key === 'api' ? item.api : column.key === 'session' ? item.session : null"
        >
          {{ cell(column, item) }}
        </span>
      </template>

      <template #tfoot>
        <tr class="total-row">
          <td v-for="(column, index) in columns" :key="column.key">
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
    <SessionDetailDialog v-model="detailOn" :row="detailRow" />
  </v-card>
</template>

<style scoped>

.table-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-tools {
  flex: none;
  display: flex;
  gap: 1rem;
  padding: 4px 12px 0;
}

.table-card :deep(.click-row) {
  cursor: pointer;
}

.table-card :deep(.v-data-table) {
  flex: 1 1 auto;
  min-height: 0;
}

.table-card :deep(.v-data-table th),
.table-card :deep(.v-data-table td) {
  padding: 0 10px;
}

.table-card :deep(.v-data-table td) {
  vertical-align: middle;
  white-space: nowrap;
}

.session-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.cell-warn {
  color: rgb(var(--v-theme-peak));
}

.cell-good {
  color: rgb(var(--v-theme-success));
}

.total-row td {
  height: var(--v-table-row-height);
  padding: 0 10px;
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
  white-space: nowrap;
  /* Vuetify 吸底选择器少一层 wrapper。 */
  background: rgb(var(--v-theme-surface));
  box-shadow: inset 0 1px 0 rgba(var(--v-border-color), var(--v-border-opacity));
}

:deep(.cached-row) {
  background: rgb(var(--v-theme-cached));
}
</style>
