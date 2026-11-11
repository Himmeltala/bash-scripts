<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { view } from '../composables/useView'
import { COLUMNS, SOURCE_LIST, cellValue } from '../composables/format'

const rows = computed(() => {
  const list = [...(data.value?.rows || [])].map((row) => ({ ...row }))
  const { key, desc } = view.sort
  if (!key) return list
  const column = COLUMNS[data.value?.command].find((item) => item.key === key)
  const sign = desc ? -1 : 1
  return list.sort((a, b) => {
    if (column?.num || column?.money) return sign * ((Number(a[key]) || 0) - (Number(b[key]) || 0))
    return sign * String(a[key] || '').localeCompare(String(b[key] || ''), 'zh-CN')
  })
})

const columns = computed(() => COLUMNS[data.value?.command || 'daily'] || COLUMNS.daily)
const showTotals = computed(() => !!rows.value.length && !!data.value?.totals)

function sortBy(column) {
  if (view.sort.key === column.key) view.sort.desc = !view.sort.desc
  else view.sort = { key: column.key, desc: !(column.num || column.money) }
}

function sourceOf(key) {
  return SOURCE_LIST.find((item) => item.key === key)
}

const cell = (column, row) => cellValue(column, row)
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            :class="{
              num: column.num || column.money,
              asc: view.sort.key === column.key && !view.sort.desc,
              desc: view.sort.key === column.key && view.sort.desc,
            }"
            @click="sortBy(column)"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index" :class="{ cached: row.origin === 'cache' }">
          <td
            v-for="column in columns"
            :key="column.key"
            :class="{ num: column.num || column.money, strong: column.strong, mono: column.mono }"
            :style="column.width ? { maxWidth: `${column.width}rem` } : null"
            :title="column.key === 'api' ? row.api : null"
          >
            <template v-if="column.key === 'source'">
              <span class="mark">{{ sourceOf(row.source)?.mark || '?' }}</span>{{ cell(column, row) }}
            </template>
            <template v-else>{{ cell(column, row) }}</template>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="showTotals">
        <tr>
          <th v-for="column in COLUMNS.totalsFor(data.command)" :key="column.key" :class="{ num: column.num || column.money }">
            {{ column.label === '合计' ? '合计' : cell(column, data.totals) }}
          </th>
        </tr>
      </tfoot>
    </table>
    <p v-if="!rows.length" class="empty">没有找到用量记录。</p>
  </div>
</template>
