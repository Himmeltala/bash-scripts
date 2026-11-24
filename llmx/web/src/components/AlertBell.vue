<template>
  <v-menu location="bottom end" offset="8">
    <template #activator="{ props }">
      <v-btn v-bind="props" variant="text" :title="summary" :aria-label="summary">
        <v-badge v-if="rows.length" :content="rows.length" :color="tone" offset-x="6" offset-y="-4">
          <v-icon :icon="icon" :color="tone" />
        </v-badge>
        <v-icon v-else :icon="icon" color="on-surface-variant" />
      </v-btn>
    </template>

    <v-card width="360">
      <v-card-title class="head">警示</v-card-title>
      <v-card-text v-if="rows.length" class="list">
        <p
          v-for="(row, index) in rows"
          :key="index"
          class="row"
          :class="row.level === 'bad' ? 'text-error' : 'text-warning'"
        >
          <v-icon
            :icon="row.level === 'bad' ? 'mdi-alert-octagon-outline' : 'mdi-alert-outline'"
            size="16"
            class="mark"
          />
          <span class="text">{{ row.text }}</span>
          <v-btn
            v-if="row.kind === 'unpriced'"
            to="/pricing"
            size="x-small"
            variant="text"
            color="primary"
            class="fix"
          >
            去补价
          </v-btn>
        </p>
      </v-card-text>
      <v-card-text v-else class="empty">暂无警示</v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-wallet-outline" to="/budget">预算设置</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { loadBudgets, refreshSpend } from '../composables/useBudgets.js'
import { useWarnings } from '../composables/useWarnings.js'

const { rows, tone } = useWarnings()
const icon = computed(() => {
  if (tone.value === 'error') return 'mdi-bell-alert'
  if (tone.value === 'warning') return 'mdi-bell'
  return 'mdi-bell-outline'
})
const summary = computed(() => (rows.value.length ? `${rows.value.length} 条警示` : '暂无警示'))

// 预算与花费分开取：预算接口失败时，无价格模型仍能单独刷新。
function refreshAll() {
  loadBudgets().catch(() => {})
  refreshSpend()
}

let timer = 0

function start() {
  if (!timer) timer = setInterval(refreshAll, 5 * 60 * 1000)
}

function stop() {
  clearInterval(timer)
  timer = 0
}

function onVisible() {
  if (document.hidden) {
    stop()
    return
  }
  refreshAll()
  start()
}

onMounted(() => {
  refreshAll()
  start()
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped>
.head {
  font-size: 0.92rem;
  font-weight: 600;
  padding-bottom: 4px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
  padding-top: 0;
}
.row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
}
.mark {
  flex: none;
  margin-top: 2px;
}
.text {
  flex: 1 1 auto;
  min-width: 0;
}
.fix {
  flex: none;
  margin: -4px 0;
}
.empty {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
}
</style>
