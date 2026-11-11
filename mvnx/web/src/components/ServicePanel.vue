<template>
  <div class="panel">
    <header class="head">
      <div class="titles">
        <h2>{{ baseName(ws.root) }}</h2>
        <p class="root" :title="ws.root">{{ ws.root }}</p>
      </div>
      <div class="actions">
        <v-chip size="small" variant="tonal">{{ ws.poms.length }} 个模块</v-chip>
        <v-chip v-if="running" size="small" color="ready" variant="tonal">{{ running }} 个在跑</v-chip>
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="$emit('scan')">重新扫描</v-btn>
        <v-btn size="small" variant="text" color="error" @click="$emit('forget', ws.id)">移出</v-btn>
      </div>
    </header>

    <div class="tabs">
      <v-btn
        v-for="t in tabs"
        :key="t.value"
        size="small"
        :variant="tab === t.value ? 'flat' : 'text'"
        :color="tab === t.value ? 'primary' : undefined"
        @click="tab = t.value"
      >
        {{ t.title }}
        <v-chip v-if="count(t.value)" size="x-small" class="count" variant="text">{{ count(t.value) }}</v-chip>
      </v-btn>
      <v-spacer />
      <v-text-field
        v-model="filter"
        density="compact"
        variant="solo"
        flat
        hide-details
        placeholder="按模块名筛"
        prepend-inner-icon="mdi-magnify"
        clearable
        class="filter"
      />
    </div>

    <div v-if="!rows.length" class="none">
      <template v-if="tab === 'history'">还没有运行记录</template>
      <template v-else-if="tab === 'poms'">没扫到 pom</template>
      <template v-else>这一栏没有可执行的模块，换个栏目看看，或点重新扫描。</template>
    </div>

    <v-table v-else density="compact" class="table">
      <thead>
        <tr>
          <th style="width: 42%">模块</th>
          <th>参数</th>
          <th style="width: 150px">状态</th>
          <th style="width: 190px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td>
            <div class="svc-name">{{ row.title }}</div>
            <div class="svc-path" :title="row.path">{{ row.path }}</div>
          </td>
          <td>
            <div class="cmd" :title="row.cmd">{{ row.cmd }}</div>
          </td>
          <td>
            <template v-if="row.live">
              <v-chip size="small" :color="row.color" variant="tonal" :prepend-icon="row.icon">
                {{ row.statusText }}
              </v-chip>
              <div v-if="row.port" class="meta">端口 {{ row.port }}</div>
              <div v-else-if="row.started" class="meta">{{ row.ago }}</div>
            </template>
            <template v-else-if="row.run">
              <v-chip size="small" :color="row.color" variant="tonal" :prepend-icon="row.icon" @click="openLog(row)">
                {{ row.statusText }}
              </v-chip>
              <div v-if="row.err" class="meta err" :title="row.err">{{ row.err }}</div>
              <div v-else-if="row.started" class="meta">{{ row.ago }}</div>
            </template>
            <span v-else class="meta">—</span>
          </td>
          <td class="ops">
            <template v-if="tab === 'history'">
              <v-btn size="small" variant="text" prepend-icon="mdi-text-box-outline" @click="openLog(row)">日志</v-btn>
            </template>
            <template v-else>
              <v-btn v-if="row.live" size="small" color="error" variant="tonal" :loading="row.stopping" @click="stop(row)">
                停止
              </v-btn>
              <template v-else>
                <v-btn
                  size="small"
                  color="primary"
                  variant="flat"
                  :disabled="row.blocked"
                  :loading="row.starting"
                  @click="start(row)"
                >
                  {{ row.action }}
                </v-btn>
                <v-btn size="small" variant="text" :icon="true" title="参数与日志" @click="openSettings(row)">
                  <v-icon size="20">mdi-tune</v-icon>
                </v-btn>
              </template>
            </template>
          </td>
        </tr>
      </tbody>
    </v-table>

    <SettingsDialog
      v-model="settings.on"
      :svc="settings.svc"
      :poms="ws.poms"
      :log-text="settings.log"
      :log-more="settings.more"
      :log-status="settings.logStatus"
      :dark="dark"
      @save="onSave"
      @load-more="loadMoreLog"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import SettingsDialog from './SettingsDialog.vue'
import { api } from '../composables/useApi'
import {
  LIVE,
  STATUS_COLOR,
  STATUS_TEXT,
  TYPE_TEXT,
  ago,
  moduleOf,
} from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['start', 'stop', 'save', 'scan', 'forget'])

const tabs = [
  { value: 'service', title: '启动服务' },
  { value: 'package', title: '打包' },
  { value: 'install', title: '安装' },
  { value: 'history', title: '运行记录' },
  { value: 'poms', title: '模块清单' },
]
const tab = ref('service')
const filter = ref('')
const stopping = ref({})
const starting = ref({})

const settings = reactive({ on: false, svc: null, log: '', more: false, page: 0, logStatus: '' })

const running = computed(() => props.ws.services.filter((s) => s.run && LIVE.includes(s.run.status)).length)

function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : full
}

function typeTab(type) {
  return type === 'run' || type === 'war' ? 'service' : type
}

function matches(text) {
  const q = filter.value.trim()
  return !q || String(text || '').includes(q)
}

function count(value) {
  if (value === 'history') return 0
  if (value === 'poms') return 0
  return props.ws.services.filter((s) => typeTab(s.type) === value && matches(s.tag)).length
}

const latestRuns = computed(() => {
  const map = new Map()
  for (const svc of props.ws.services) {
    if (svc.run) map.set(svc.id, svc.run)
  }
  return map
})

// 列表按栏目拼：服务与模块共用一个动作按钮，历史栏把运行记录原样列出来。
const rows = computed(() => {
  if (tab.value === 'poms') {
    return props.ws.poms
      .filter(matches)
      .map((rel) => ({ key: rel, title: moduleOf(rel), path: rel, cmd: rel, action: '', live: false }))
  }
  if (tab.value === 'history') {
    const out = []
    for (const svc of props.ws.services) {
      const run = svc.run
      if (!run) continue
      if (!matches(svc.tag)) continue
      out.push({
        key: run.id,
        run,
        svc,
        title: svc.tag,
        path: svc.display,
        cmd: run.cmd,
        statusText: STATUS_TEXT[run.status] || run.status,
        color: STATUS_COLOR[run.status] || 'grey',
        icon: iconOf(run.status),
        live: LIVE.includes(run.status),
        err: run.err,
        port: run.port,
        started: run.started,
        ago: ago(run.started),
      })
    }
    out.sort((a, b) => Number(b.started || 0) - Number(a.started || 0))
    return out
  }

  return props.ws.services
    .filter((s) => typeTab(s.type) === tab.value)
    .filter((s) => matches(s.tag) || matches(s.display))
    .map((svc) => {
      const run = svc.run
      const live = !!run && LIVE.includes(run.status)
      // 同一模块上的另一个动作在跑时不能起：打包与启动抢同一个 target。
      const parent = svc.id.slice(0, svc.id.lastIndexOf('.'))
      const blocked = props.ws.services.some(
        (o) => o !== svc && o.run && LIVE.includes(o.run.status) && (o.id === svc.id || o.id.startsWith(parent + '.')),
      )
      return {
        key: svc.id,
        svc,
        run,
        title: svc.tag,
        path: svc.display,
        cmd: svc.cmd,
        action: TYPE_TEXT[svc.type] || '执行',
        live,
        blocked,
        statusText: run ? STATUS_TEXT[run.status] || run.status : '',
        color: run ? STATUS_COLOR[run.status] || 'grey' : 'grey',
        icon: run ? iconOf(run.status) : 'mdi-circle-outline',
        err: run && run.err,
        port: run && run.port,
        started: run && run.started,
        ago: run ? ago(run.started) : '',
        stopping: !!stopping.value[svc.id],
        starting: !!starting.value[svc.id],
      }
    })
})

function iconOf(status) {
  if (status === 'ready') return 'mdi-play-circle'
  if (status === 'starting') return 'mdi-progress-clock'
  if (status === 'failed') return 'mdi-alert-circle'
  if (status === 'exited') return 'mdi-check-circle'
  return 'mdi-stop-circle'
}

async function start(row) {
  starting.value[row.svc.id] = true
  emit('start', { svc: row.svc.id })
  setTimeout(() => {
    starting.value[row.svc.id] = false
  }, 1500)
}

async function stop(row) {
  stopping.value[row.svc.id] = true
  emit('stop', row.run.id)
  setTimeout(() => {
    stopping.value[row.svc.id] = false
  }, 3000)
}

async function openSettings(row) {
  settings.svc = row.svc
  settings.log = ''
  settings.more = false
  settings.page = 0
  settings.logStatus = ''
  settings.on = true
  if (row.run) await loadLog(row.run.id, 0)
}

async function openLog(row) {
  settings.svc = row.svc || null
  settings.on = true
  settings.log = ''
  settings.more = false
  settings.page = 0
  settings.logStatus = ''
  await loadLog(row.run.id, 0)
}

async function loadLog(run, page) {
  try {
    const data = await api.log(run, page)
    settings.log = page === 0 ? data.text : data.text + (settings.log ? '\n' + settings.log : '')
    settings.more = data.more
    settings.page = page
    settings.logStatus = data.status ? STATUS_TEXT[data.status] || data.status : ''
  } catch (err) {
    settings.log = `读日志失败：${err.message}`
  }
}

function loadMoreLog(run) {
  if (settings.more) loadLog(run, settings.page + 1)
}

function onSave({ module, args }) {
  emit('save', { svc: settings.svc.id, module, args })
}
</script>

<style scoped>
.panel {
  padding: 16px 20px 40px;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.titles h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.root {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
  word-break: break-all;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 14px 0 10px;
  flex-wrap: wrap;
}
.count {
  margin-left: 6px;
}
.filter {
  max-width: 220px;
}
.table {
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}
.svc-name {
  font-weight: 500;
}
.svc-path,
.meta {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.cmd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 420px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.err {
  color: rgb(var(--v-theme-failed));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.ops {
  text-align: right;
  white-space: nowrap;
}
.none {
  padding: 28px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
