<template>
  <div class="panel">
    <header class="head">
      <div class="titles">
        <h2>{{ baseName(ws.root) }}</h2>
        <p class="root" :title="ws.root">{{ ws.root }}</p>
      </div>
      <div class="actions">
        <v-chip size="small" variant="tonal" :prepend-icon="ws.kind === 'gradle' ? 'mdi-elephant' : 'mdi-language-java'">
          {{ KIND_TEXT[ws.kind] || ws.kind }}
        </v-chip>
        <v-select
          v-if="ws.kind !== 'gradle'"
          :model-value="ws.jdk || ''"
          :items="jdkItems"
          item-title="label"
          item-value="path"
          label="JDK"
          density="compact"
          variant="outlined"
          hide-details
          class="jdk"
          :prepend-inner-icon="ws.jdk_missing ? 'mdi-alert' : 'mdi-language-java'"
          :title="jdkTitle"
          @update:model-value="pickJdk"
        />
        <v-chip v-if="ws.kind === 'mvn'" size="small" variant="tonal">{{ ws.poms.length }} 个模块</v-chip>
        <v-chip v-else size="small" variant="tonal">{{ ws.services.length }} 个目标</v-chip>
        <v-chip v-if="running" size="small" color="ready" variant="tonal">{{ running }} 个在跑</v-chip>
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="$emit('scan')">重新扫描</v-btn>
        <v-btn size="small" variant="text" color="error" @click="$emit('forget', ws.id)">移出</v-btn>
      </div>
    </header>

    <div class="tabs">
      <v-tabs v-model="tab" density="compact" color="primary" mandatory show-arrows class="tab-row">
        <v-tab v-for="t in tabs" :key="t.value" :value="t.value">
          {{ t.title }}
          <v-chip v-if="count(t.value)" size="x-small" class="count" variant="text">{{ count(t.value) }}</v-chip>
        </v-tab>
      </v-tabs>
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
      <template v-if="tab === 'poms'">没扫到 pom</template>
      <template v-else>这一栏没有可执行的模块，换个栏目看看，或点重新扫描。</template>
    </div>

    <v-table v-else-if="tab === 'poms'" density="compact" class="table">
      <thead>
        <tr>
          <th>模块</th>
          <th>路径</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td class="svc-name">{{ row.title }}</td>
          <td class="svc-path" :title="row.path">{{ row.path }}</td>
        </tr>
      </tbody>
    </v-table>

    <ServiceTable
      v-else
      :rows="rows"
      name-title="模块"
      @start="start"
      @stop="stop"
      @settings="openSettings"
      @log="openLog"
    />

    <SettingsDialog
      v-model="settings.on"
      :svc="settings.svc"
      :kind="ws.kind"
      :log-text="logText"
      :log-more="logMore"
      :log-status="logStatus"
      :dark="dark"
      @save="onSave"
      @load-more="loadMoreLog"
    />

    <FloatingDialog
      v-model="custom.on"
      :initial-width="560"
      :initial-height="300"
      :min-width="400"
      :min-height="220"
    >
      <template #title>自定义 JDK</template>
      <v-text-field
        v-model="custom.path"
        label="JAVA_HOME"
        placeholder="/opt/jdk-17"
        density="compact"
        variant="outlined"
        hide-details="auto"
        hint="填 JDK 根目录，目录下要有 bin/java 与 bin/javac"
        persistent-hint
        autofocus
      />
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="custom.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" @click="saveCustom">保存</v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import SettingsDialog from './SettingsDialog.vue'
import { usePreferencesStore } from '../stores/preferences'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { ServiceTable, useRunLog } from '@bash-scripts/web-shared'
import { api } from '../composables/useApi'
import {
  KIND_TEXT,
  LIVE,
  STATUS_COLOR,
  STATUS_TEXT,
  TYPE_TEXT,
  ago,
  moduleOf,
  runningCount,
} from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
  jdks: { type: Array, default: () => [] },
  currentJdk: { type: String, default: '' },
})
const emit = defineEmits(['start', 'stop', 'save', 'setjdk', 'scan', 'forget', 'notice'])

// Maven 与 Gradle 的命令不同，页签跟着工作区类型走。
const tabs = computed(() =>
  props.ws.kind === 'gradle'
    ? [
        { value: 'run', title: '启动' },
        { value: 'build', title: '构建' },
      ]
    : [
        { value: 'service', title: '启动服务' },
        { value: 'package', title: '打包' },
        { value: 'install', title: '安装' },
        { value: 'poms', title: '模块清单' },
      ],
)
// 栏目选择记在全局偏好里，换工作区、刷新页面都停在原处；换类型时回到第一条。
const { activeTab: tab } = storeToRefs(usePreferencesStore())
watch(
  () => props.ws && props.ws.scan_error,
  (text) => {
    if (text) emit('notice', { text, color: 'warning' })
  },
)
watch(
  () => props.ws.kind,
  () => {
    if (!tabs.value.some((item) => item.value === tab.value)) tab.value = tabs.value[0].value
  },
  { immediate: true },
)
const filter = ref('')
const stopping = ref({})
const starting = ref({})

const settings = reactive({ on: false, svc: null })
const custom = reactive({ on: false, path: '' })
// 日志弹窗的文本、翻页与状态跟着当前运行走。
const {
  text: logText,
  more: logMore,
  status: logStatus,
  open: openLogRun,
  close: closeLogRun,
  loadMore: loadMoreLog,
} = useRunLog({ api, ws: () => props.ws, statusText: STATUS_TEXT })

const CUSTOM = '__jvmx_custom__'

const jdkItems = computed(() => {
  const items = [{ label: '跟随当前环境', path: '' }]
  for (const item of props.jdks) items.push({ label: item.label, path: item.path })
  // 存着但没扫到的路径也要列出来，否则下拉里看不到当前值。
  const cur = props.ws.jdk || ''
  if (cur && !props.jdks.some((item) => item.path === cur)) items.push({ label: cur, path: cur })
  items.push({ label: '自定义路径…', path: CUSTOM })
  return items
})

const jdkTitle = computed(() => {
  if (props.ws.jdk_missing) return `选中的 JDK 已不存在，启动时回退到当前环境：${props.ws.jdk}`
  if (props.ws.jdk) return props.ws.jdk
  return props.currentJdk ? `跟随当前环境：${props.currentJdk}` : '跟随启动服务时的环境'
})

function pickJdk(value) {
  if (value === CUSTOM) {
    custom.path = props.ws.jdk || ''
    custom.on = true
    return
  }
  emit('setjdk', { ws: props.ws.id, jdk: value })
}

function saveCustom() {
  emit('setjdk', { ws: props.ws.id, jdk: custom.path.trim() })
  custom.on = false
}

const running = computed(() => runningCount(props.ws))

function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : full
}

function typeTab(type) {
  if (props.ws.kind === 'gradle') return type
  return type === 'run' || type === 'war' ? 'service' : type
}

function matches(text) {
  const q = filter.value.trim()
  return !q || String(text || '').includes(q)
}

function count(value) {
  if (value === 'poms') return 0
  return props.ws.services.filter((s) => typeTab(s.type) === value && matches(s.tag)).length
}

// 列表按栏目拼：每个动作只看自己的模块，日志也从这一行打开。
const rows = computed(() => {
  if (tab.value === 'poms') {
    return props.ws.poms
      .filter(matches)
      .map((rel) => ({ key: rel, title: moduleOf(rel), path: rel }))
  }

  return props.ws.services
    .filter((s) => typeTab(s.type) === tab.value)
    .filter((s) => matches(s.tag) || matches(s.display))
    .map((svc) => {
      const run = svc.run
      const live = !!run && LIVE.includes(run.status)
      // 同一模块上的另一个动作在跑时不能起：打包与启动抢同一个 target；同工作区的别的模块不受影响。
      const blocked = props.ws.services.some(
        (o) => o !== svc && o.run && LIVE.includes(o.run.status) && o.tag === svc.tag,
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
  // 启动方式与 Gradle 的刷新依赖跟着这一行走，保存过就按保存的来。
  emit('start', {
    svc: row.svc.id,
    mode: row.svc.mode || 'auto',
    refresh: !!row.svc.refresh,
  })
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

function openSettings(row) {
  settings.svc = row.svc
  settings.on = true
  openLogRun(row.run, row.svc.id)
}

function openLog(row) {
  if (!row.run) return
  settings.svc = row.svc || null
  settings.on = true
  openLogRun(row.run, (row.svc || {}).id || '')
}

// 弹窗关掉就断开日志流，与以前的 watch(settings.on) 一致。
watch(
  () => settings.on,
  (on) => {
    if (!on) closeLogRun()
  },
)

function onSave({ module, args, mode, refresh }) {
  emit('save', { svc: settings.svc.id, module, args, mode, refresh })
}
</script>

<style scoped>
/* 面板占满右侧剩下的高度：标题与栏目固定，表格自己滚。 */
.panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
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
.jdk {
  max-width: 240px;
  min-width: 170px;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 14px 0 10px;
  flex-wrap: wrap;
}
/* 栏目条与右侧筛选框同一行：页签条自己按内容宽，窄窗口里横向滚动不折行。 */
.tab-row {
  flex: 0 1 auto;
  min-width: 0;
}
.count {
  margin-left: 6px;
}
.filter {
  max-width: 220px;
}
.table {
  flex: 1 1 auto;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}
.svc-name {
  font-weight: 500;
}
.svc-path {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.none {
  padding: 28px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
