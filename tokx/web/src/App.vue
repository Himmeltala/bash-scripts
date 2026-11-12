<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { COMMANDS, EVERY, RANGES, SOURCES, view } from './composables/useView'
import { busy, close as closeStream, data, error, load, loadedAt, subscribe } from './composables/useUsage'
import { rememberTheme } from './plugins/vuetify'
import SummaryCards from './components/SummaryCards.vue'
import UsageCharts from './components/UsageCharts.vue'
import UsageTable from './components/UsageTable.vue'

const theme = useTheme()
// 没手动切过深浅色时跟着系统走，系统换主题页面当场跟上。
if (!localStorage.getItem('tokx-theme')) {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (event) => {
    if (!localStorage.getItem('tokx-theme')) theme.global.name.value = event.matches ? 'dark' : 'light'
  })
}

const stamp = computed(() => {
  if (error.value) return `读取失败：${error.value}`
  if (!loadedAt.value) return '正在读取…'
  return `刷新于 ${loadedAt.value.replace('T', ' ')} · ${data.value?.timezone || ''}`
})

const notice = computed(() => {
  const models = data.value?.unpriced_models || []
  return models.length ? `这些模型没有价格，只算 token 不算钱：${models.join('、')}` : ''
})

const hasRows = computed(() => !!data.value?.rows.length)

function refresh() {
  if (view.every) subscribe(view.every)
  else load()
}

function reload() {
  view.sort = { key: '', desc: true }
  refresh()
}

function flipTheme() {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
  rememberTheme(theme.global.name.value)
}

watch(() => view.every, (every) => {
  if (every) subscribe(every)
  else closeStream()
})
watch(() => [view.command, view.range, view.since, view.until, view.sources.join(',')], reload)

function onVisible() {
  if (document.hidden) closeStream()
  else refresh()
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisible)
  refresh()
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
        <span class="stamp">{{ stamp }}</span>
      </v-app-bar-title>
      <template #append>
        <v-btn
          :icon="theme.global.current.value.dark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
          :title="theme.global.current.value.dark ? '切到浅色' : '切到深色'"
          variant="text"
          @click="flipTheme"
        />
        <v-btn
          icon="mdi-refresh"
          title="立刻刷新一次"
          variant="text"
          :loading="busy"
          @click="load"
        />
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 page">
        <v-sheet border rounded class="filters pa-3 mb-4">
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
              <v-text-field
                v-model="view.since"
                type="date"
                label="起始日期"
                density="compact"
                variant="outlined"
                hide-details
                class="pick"
              />
              <v-text-field
                v-model="view.until"
                type="date"
                label="结束日期"
                density="compact"
                variant="outlined"
                hide-details
                class="pick"
              />
            </template>
            <v-chip-group v-model="view.sources" multiple filter selected-class="text-primary">
              <v-chip
                v-for="item in SOURCES"
                :key="item.key"
                :value="item.key"
                :prepend-icon="`mdi-${item.key === 'claude' ? 'robot-outline' : item.key === 'opencode' ? 'code-braces' : 'brain'}`"
                variant="tonal"
                size="small"
              >
                {{ item.name }}
              </v-chip>
            </v-chip-group>
            <v-spacer />
            <v-select
              v-model.number="view.every"
              :items="EVERY"
              :item-title="(value) => (value ? `${value} 秒` : '关闭')"
              label="自动刷新"
              density="compact"
              variant="outlined"
              hide-details
              class="pick-pull"
            />
            <v-btn variant="flat" color="primary" prepend-icon="mdi-check" :disabled="busy" @click="load">
              刷新
            </v-btn>
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
  margin-right: 0.9rem;
}

.stamp {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.85rem;
  font-weight: 400;
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

.pick-pull {
  flex: 0 0 8rem;
}

</style>
