<template>
  <v-container fluid class="pa-2 page">
    <v-sheet rounded class="filters pa-3 mb-2">
      <div class="filters-row">
        <v-select
          v-model="view.command"
          :items="COMMANDS"
          item-title="name"
          item-value="key"
          label="报表"
          density="compact"
          variant="outlined"
          hide-details
          class="pick"
        />
        <v-select
          v-model="view.range"
          :items="RANGES"
          item-title="name"
          item-value="key"
          label="范围"
          density="compact"
          variant="outlined"
          hide-details
          class="pick"
        />
        <v-date-input
          v-if="view.range === 'custom'"
          v-model="rangeDates"
          label="日期范围"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          multiple="range"
          class="range-pick"
        />
        <v-select
          v-model="view.sources"
          :items="SOURCES"
          item-title="name"
          item-value="key"
          label="来源"
          multiple
          density="compact"
          variant="outlined"
          hide-details
          class="source-pick"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <BrandIcon :name="item.raw.key" :size="16" />
              </template>
            </v-list-item>
          </template>
        </v-select>
        <v-select
          v-model="view.models"
          :items="modelOptions"
          label="模型"
          multiple
          density="compact"
          variant="outlined"
          hide-details
          class="narrow-pick"
        />
        <v-select
          v-model="view.projects"
          :items="projectOptions"
          label="项目"
          multiple
          density="compact"
          variant="outlined"
          hide-details
          class="narrow-pick"
        />
      </div>
    </v-sheet>

    <SummaryCards v-if="data" class="mb-2" />
    <CompareCards v-if="data" />

    <UsageCharts v-if="hasRows" class="mb-2" />
    <div v-if="hasRows" class="table-area">
      <UsageTable />
    </div>
    <p v-else-if="data && !error" class="hint">没有找到用量记录。</p>
  </v-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { COMMANDS, RANGES, SOURCES, query, view } from './composables/useView'
import { close as closeStream, data, error, subscribe } from './composables/useUsage'
import BrandIcon from '../../components/BrandIcon.vue'
import SummaryCards from './components/SummaryCards.vue'
import CompareCards from './components/CompareCards.vue'
import UsageCharts from './components/UsageCharts.vue'
import UsageTable from './components/UsageTable.vue'
import { VDateInput } from 'vuetify/labs/VDateInput'
import { formatDate } from '@bash-scripts/web-shared/format'
import { toast } from '../../composables/notice'

// 筛选状态里存 YYYY-MM-DD，日期组件收发的是本地时区的 Date，两边在这里换。
function dayToDate(text) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '')
  if (!hit) return null
  const date = new Date(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3]))
  return Number.isNaN(date.getTime()) ? null : date
}


// Vuetify 没有独立的日期范围组件，VDateInput 的 multiple="range" 就是范围选择：
// 选满两个端点后模型里是整段日期，这里只留首尾，存进筛选状态的 since 与 until。
const rangeDates = computed({
  get: () => [dayToDate(view.value.since), dayToDate(view.value.until)].filter(Boolean),
  set: (value) => {
    const list = Array.isArray(value) ? value.filter(Boolean) : []
    view.value.since = formatDate(list[0])
    view.value.until = formatDate(list[list.length - 1])
  },
})

const hasRows = computed(() => !!data.value?.rows.length)
const modelOptions = computed(() => data.value?.facets?.models || [])
const projectOptions = computed(() => data.value?.facets?.projects || [])

// 错误走全局 snackbar，页面不再为一条消息让出布局。
watch(error, (text) => text && toast(text, 'error'))

function reload() {
  subscribe()
}

// 查询串是唯一的参数来源：新增筛选项只改 useView.query()，这里不用跟着列字段。
watch(() => query().toString(), reload)

function onVisible() {
  if (document.hidden) closeStream()
  else subscribe()
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisible)
  subscribe()
})

onBeforeUnmount(() => {
  closeStream()
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped>
.hint {
  margin: 16px 0;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top));
  overflow: hidden;
}

.page > * {
  flex: none;
}

.table-area {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.table-area > * {
  flex: 1 1 auto;
  min-width: 0;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.pick {
  flex: 0 0 9.5rem;
}

.source-pick {
  flex: 0 1 16rem;
  min-width: 11rem;
}

.narrow-pick {
  flex: 0 1 12rem;
  min-width: 9rem;
}

.source-pick :deep(.v-field__input) {
  flex-wrap: nowrap;
  overflow: hidden;
}

.range-pick {
  flex: 0 0 20rem;
  max-width: 100%;
}
</style>
