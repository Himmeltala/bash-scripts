<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { COMMANDS, RANGES, SOURCES, view } from './composables/useView'
import { close as closeStream, data, error, subscribe } from './composables/useUsage'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { rememberTheme } from './plugins/vuetify'
import BrandIcon from './components/BrandIcon.vue'
import SummaryCards from './components/SummaryCards.vue'
import UsageCharts from './components/UsageCharts.vue'
import UsageTable from './components/UsageTable.vue'
import { VDateInput } from 'vuetify/labs/VDateInput'

// 地址栏里存 YYYY-MM-DD，日期组件收发的是本地时区的 Date，两边在这里换。
function dayToDate(text) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '')
  if (!hit) return null
  const date = new Date(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function dateToDay(value) {
  if (!value) return ''
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

const sinceDate = computed({
  get: () => dayToDate(view.since),
  set: (value) => {
    view.since = dateToDay(value)
  },
})
const untilDate = computed({
  get: () => dayToDate(view.until),
  set: (value) => {
    view.until = dateToDay(value)
  },
})

// 没手动切过深浅色时跟着系统走，系统换主题页面当场跟上。
const { dark, toggle: flipTheme } = useThemeToggle({
  storageKey: 'tokx-theme',
  rememberTheme,
  followSystem: true,
})

const notice = computed(() => {
  const models = data.value?.unpriced_models || []
  return models.length ? `这些模型没有价格，只算 token 不算钱：${models.join('、')}` : ''
})

const hasRows = computed(() => !!data.value?.rows.length)

function reload() {
  view.sort = { key: '', desc: true }
  subscribe()
}

watch(() => [view.command, view.range, view.since, view.until, view.sources.join(',')], reload)

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

<template>
  <v-app>
    <v-app-bar density="comfortable" flat border>
      <v-app-bar-title>
        <span class="title">tokx</span>
      </v-app-bar-title>
      <template #append>
        <v-btn
          :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          :title="dark ? '切到浅色' : '切到深色'"
          variant="text"
          @click="flipTheme"
        />
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 page">
        <v-sheet rounded class="filters pa-3 mb-4">
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
            <template v-if="view.range === 'custom'">
              <v-date-input
                v-model="sinceDate"
                label="起始日期"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="pick"
              />
              <v-date-input
                v-model="untilDate"
                label="结束日期"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                class="pick"
              />
            </template>
            <v-chip-group v-model="view.sources" multiple filter selected-class="text-primary">
              <v-chip
                v-for="item in SOURCES"
                :key="item.key"
                :value="item.key"
                variant="tonal"
                size="small"
              >
                <template #prepend>
                  <BrandIcon :name="item.key" :size="16" />
                </template>
                {{ item.name }}
              </v-chip>
            </v-chip-group>
          </div>
        </v-sheet>

        <SummaryCards v-if="data" class="mb-4" />

        <v-alert v-if="notice" type="warning" variant="tonal" density="compact" class="mb-4">
          {{ notice }}
        </v-alert>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <UsageCharts v-if="hasRows" class="mb-4" />
        <UsageTable v-if="hasRows" />
        <v-alert v-else-if="data && !error" type="info" variant="tonal" density="compact">
          没有找到用量记录。
        </v-alert>

      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.title {
  font-weight: 700;
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
</style>
