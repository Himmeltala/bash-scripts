<template>
  <v-app>
    <v-app-bar density="comfortable" flat border>
      <v-app-bar-nav-icon
        :title="drawer ? '收起筛选' : '展开筛选'"
        @click="drawer = !drawer"
      />
      <v-app-bar-title>
        <span class="brand">netx</span>
      </v-app-bar-title>
      <v-chip
        size="small"
        variant="tonal"
        :color="state.color"
        :prepend-icon="state.icon"
        class="state-chip"
      >
        {{ state.text }}
      </v-chip>
      <v-chip size="small" variant="text" prepend-icon="mdi-swap-horizontal">
        {{ status.flows || 0 }} 条记录
      </v-chip>
      <v-spacer />
      <v-btn
        :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        :title="dark ? '切到浅色' : '切到深色'"
        variant="text"
        @click="toggleTheme"
      />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" :width="navWidth">
      <div class="nav">
        <div class="nav-body">
          <div class="section">
            <button class="section-title" :aria-expanded="!isCollapsed('filter')" @click="toggleSection('filter')">
              <v-icon size="16">{{ isCollapsed('filter') ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
              <span>筛选</span>
            </button>
            <div v-show="!isCollapsed('filter')">
              <v-select
                v-model="minutes"
                :items="RANGES"
                item-title="label"
                item-value="value"
                label="时间范围"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model="search"
                label="进程、PID 或目标地址"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="outlined"
                clearable
                hide-details
                class="field"
              />
              <p class="hint">搜索只过滤当前这张表，不影响采集。</p>
            </div>
          </div>
          <v-divider />
          <div class="section">
            <button class="section-title" :aria-expanded="!isCollapsed('collect')" @click="toggleSection('collect')">
              <v-icon size="16">{{ isCollapsed('collect') ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
              <span>采集</span>
            </button>
            <div v-show="!isCollapsed('collect')">
              <div class="meta"><span>最后事件</span><b>{{ lastEvent }}</b></div>
              <div class="meta"><span>推送</span><b :class="{ bad: !!streamError }">{{ streamText }}</b></div>
              <div class="meta"><span>记录窗口</span><b>{{ rangeLabel }}</b></div>
            </div>
          </div>
          <v-divider />
          <div class="section">
            <button class="section-title" :aria-expanded="!isCollapsed('data')" @click="toggleSection('data')">
              <v-icon size="16">{{ isCollapsed('data') ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
              <span>数据</span>
            </button>
            <div v-show="!isCollapsed('data')">
              <div class="meta"><span>数据库占用</span><b>{{ dbSize }}</b></div>
              <div class="meta"><span>连接 / 详情</span><b>{{ flowCount }}</b></div>
              <v-btn
                class="clean-btn"
                size="small"
                variant="tonal"
                block
                prepend-icon="mdi-delete-sweep-outline"
                @click="cleanupOpen = true"
              >
                清理数据
              </v-btn>
            </div>
          </div>
        </div>
        <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />
      </div>
    </v-navigation-drawer>

    <v-main>
      <div class="page">
        <FlowsTable
          :rows="filtered"
          :total="rows.length"
          :loading="loading"
          :range-label="rangeLabel"
          @open="openDetail"
        />
      </div>
    </v-main>

    <FlowDetailDialog v-model="detailOpen" :flow-id="detailId" />
    <CleanupDialog
      v-model="cleanupOpen"
      @done="refreshSummary"
      @notice="(event) => toast(event.text, event.color)"
    />
    <ToastHost v-model="snack.on" :text="snack.text" :color="snack.color" />
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import FlowsTable from './components/FlowsTable.vue'
import FlowDetailDialog from './components/FlowDetailDialog.vue'
import CleanupDialog from './components/CleanupDialog.vue'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { useSplitPane } from '@bash-scripts/web-shared'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { ToastHost, useToast } from '@bash-scripts/web-shared/feedbacks'
import { useFlows } from './composables/useFlows'
import { summary as fetchSummary } from './composables/useApi'
import { rememberTheme } from './plugins/vuetify'
import { formatTimestamp } from '@bash-scripts/web-shared/format'

const RANGES = [
  { label: '最近 15 分钟', value: 15 },
  { label: '最近 1 小时', value: 60 },
  { label: '最近 6 小时', value: 360 },
  { label: '最近 24 小时', value: 1440 },
]

const STATES = {
  running: { text: '采集运行中', color: 'success', icon: 'mdi-record-circle-outline' },
  starting: { text: '采集启动中', color: 'warning', icon: 'mdi-progress-clock' },
  stopped: { text: '采集未运行', color: 'warning', icon: 'mdi-stop-circle-outline' },
  error: { text: '采集异常', color: 'error', icon: 'mdi-alert-circle-outline' },
}

const drawer = ref(true)
// 分组收起状态记在本地下次接着用，键名跟侧栏宽度、主题保持同一前缀。
const collapsed = useLocalStorage('netx.nav-collapsed', {})
const minutes = ref(60)
const search = ref('')
const detailOpen = ref(false)
const detailId = ref(null)
const cleanupOpen = ref(false)
const summaryInfo = ref(null)
const { snack, toast } = useToast()

function isCollapsed(key) {
  return collapsed.value[key] === true
}

function toggleSection(key) {
  collapsed.value = { ...collapsed.value, [key]: !isCollapsed(key) }
}

function openDetail(item) {
  detailId.value = item.id
  detailOpen.value = true
}

async function refreshSummary() {
  try {
    summaryInfo.value = await fetchSummary()
  } catch (err) {
    // 侧栏摘要拿不到不影响主列表，留空即可。
  }
}

onMounted(refreshSummary)

const dbSize = computed(() =>
  summaryInfo.value
    ? formatBytes(summaryInfo.value.db_bytes, {
        units: ['B', 'KB', 'MB', 'GB'],
        precision: [0, 1, 2, 2],
      })
    : '—',
)
const flowCount = computed(() =>
  summaryInfo.value
    ? summaryInfo.value.flow_count + ' / ' + summaryInfo.value.detail_count
    : '—',
)

// 左侧栏宽度随分隔条拖动改变，双击还原；按工具名下记着，下次打开接着用。
const viewport = shallowRef(document.documentElement)
const { size: navWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: viewport,
  initial: 248,
  min: 200,
  rightMin: 520,
  persist: 'netx.nav-width',
})

const { dark, toggle: toggleTheme } = useThemeToggle({
  storageKey: 'netx-theme',
  rememberTheme,
  followSystem: true,
})

const { rows, status, loading, connected, error: streamError } = useFlows(minutes)

watch(
  () => status.value?.error,
  (text) => {
    if (text) toast(text, 'error')
  }
)
watch(streamError, (text) => {
  if (text) toast(text, 'warning')
})

const state = computed(() => {
  const item = STATES[status.value.state]
  if (item) return item
  return {
    text: '采集' + (status.value.state || '未知'),
    color: 'warning',
    icon: 'mdi-help-circle-outline',
  }
})

const lastEvent = computed(() =>
  formatTimestamp(status.value.last_event_at, { unit: 's', fallback: '—' })
)
const streamText = computed(() => {
  if (streamError.value) return '已断开'
  return connected.value ? '已连接' : '连接中'
})
const rangeLabel = computed(
  () => (RANGES.find((item) => item.value === minutes.value) || RANGES[1]).label,
)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return rows.value
  return rows.value.filter((row) => {
    const target = row.dst_ip ? row.dst_ip + ':' + row.dst_port : ''
    return [
      row.comm,
      row.exe,
      row.pid,
      row.dst_ip,
      target,
      row.detail_host,
      row.detail_url,
      row.detail_sni,
      row.detail_dns_name,
    ].some((value) => String(value || '').toLowerCase().includes(query))
  })
})
</script>

<style scoped>
.brand {
  font-weight: 600;
  letter-spacing: 0.02em;
}
.state-chip {
  margin-inline-end: 8px;
}
.nav {
  display: flex;
  height: 100%;
}
.nav-body {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
}
.section {
  padding: 16px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}
.section-title:hover {
  color: rgb(var(--v-theme-on-surface));
}
.field {
  margin-top: 12px;
}
.hint {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  margin: 8px 0 0;
}
.meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
  padding: 4px 0;
}
.meta b {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
  text-align: right;
}
.meta b.bad {
  color: rgb(var(--v-theme-error));
}
.page {
  height: calc(100dvh - 64px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.notice {
  flex: 0 0 auto;
}
.clean-btn {
  margin-top: 10px;
}
</style>
