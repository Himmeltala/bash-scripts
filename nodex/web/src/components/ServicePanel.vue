<template>
  <div class="panel">
    <header class="head">
      <div class="titles">
        <h2>{{ baseName(ws.root) }}</h2>
        <p class="root" :title="ws.root">{{ ws.root }}</p>
      </div>
      <div class="actions">
        <v-select
          :model-value="ws.node || ''"
          :items="nodeItems"
          item-title="label"
          item-value="path"
          label="Node"
          density="compact"
          variant="outlined"
          hide-details
          class="node-ver"
          :prepend-inner-icon="ws.node_missing ? 'mdi-alert' : 'mdi-nodejs'"
          :title="nodeTitle"
          @update:model-value="pickNode"
        />
        <v-chip size="small" variant="tonal">{{ ws.scripts.length }} 个脚本</v-chip>
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
      <v-btn v-if="tab !== 'zip'" size="small" variant="text" prepend-icon="mdi-plus" @click="openAdd">
        添加命令
      </v-btn>
    </div>

    <ZipPanel v-show="tab === 'zip'" :ws="ws" :dark="dark" :active="tab === 'zip'" />

    <div v-if="tab !== 'zip' && !rows.length" class="none">
      这一栏没有可执行的脚本，换个栏目看看，或者添加一条自己的命令。
    </div>

    <v-table v-else-if="tab !== 'zip'" density="compact" class="table">
      <thead>
        <tr>
          <th style="width: 42%">脚本</th>
          <th>参数</th>
          <th style="width: 200px">状态</th>
          <th style="width: 230px"></th>
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
            <div class="status-line">
              <template v-if="row.live">
                <v-chip size="small" class="status-chip" :color="row.color" variant="tonal" :prepend-icon="row.icon">
                  {{ row.statusText }}
                </v-chip>
                <span v-if="row.port" class="meta">端口 {{ row.port }}</span>
                <span v-else-if="row.started" class="meta">{{ row.ago }}</span>
              </template>
              <template v-else-if="row.run">
                <v-chip
                  size="small"
                  class="status-chip"
                  :color="row.color"
                  variant="tonal"
                  :prepend-icon="row.icon"
                  @click="openLog(row)"
                >
                  {{ row.statusText }}
                </v-chip>
                <span v-if="row.err" class="meta err" :title="row.err">{{ row.err }}</span>
                <span v-else-if="row.started" class="meta">{{ row.ago }}</span>
              </template>
              <span v-else class="meta">—</span>
            </div>
          </td>
          <td class="ops">
            <template v-if="row.live">
              <v-btn size="small" variant="text" prepend-icon="mdi-text-box-outline" @click="openLog(row)">日志</v-btn>
              <v-btn size="small" color="error" variant="tonal" :loading="row.stopping" @click="stop(row)">
                停止
              </v-btn>
            </template>
            <template v-else>
              <v-btn
                size="small"
                color="primary"
                variant="flat"
                :loading="row.starting"
                @click="start(row)"
              >
                {{ row.action }}
              </v-btn>
              <v-btn size="small" variant="text" :icon="true" title="参数" @click="openSettings(row)">
                <v-icon size="20">mdi-tune</v-icon>
              </v-btn>
              <v-btn v-if="row.run" size="small" variant="text" prepend-icon="mdi-text-box-outline" @click="openLog(row)">
                日志
              </v-btn>
            </template>
            <v-btn
              v-if="row.svc.custom && !row.live"
              size="small"
              variant="text"
              :icon="true"
              title="删除自定义命令"
              @click="dropCommand(row)"
            >
              <v-icon size="20">mdi-trash-can-outline</v-icon>
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="add.on" max-width="540">
      <v-card>
        <v-card-title>添加{{ add.action }}命令</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="add.tag"
            label="名称"
            placeholder="例如 mock"
            density="compact"
            variant="outlined"
            class="mb-4"
          />
          <v-select
            v-model="add.rel"
            :items="scriptItems"
            item-title="label"
            item-value="rel"
            label="脚本"
            density="compact"
            variant="outlined"
            class="mb-4"
          />
          <v-text-field
            v-model="add.args"
            label="完整命令"
            :placeholder="add.placeholder"
            density="compact"
            variant="outlined"
            @keyup.enter="saveCommand"
          />
          <p v-if="add.error" class="add-error">{{ add.error }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="add.on = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="add.saving" @click="saveCommand">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <SettingsDialog
      v-model="settings.on"
      :svc="settings.svc"
      :log-text="settings.log"
      :log-more="settings.more"
      :log-status="settings.logStatus"
      :dark="dark"
      @save="onSave"
      @load-more="loadMoreLog"
    />

    <v-dialog v-model="custom.on" max-width="560">
      <v-card>
        <v-card-title>自定义 Node</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="custom.path"
            label="Node 安装目录"
            placeholder="/home/me/.nvm/versions/node/v20.11.1"
            density="compact"
            variant="outlined"
            hide-details="auto"
            hint="填版本目录，目录下要有 bin/node"
            persistent-hint
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="custom.on = false">取消</v-btn>
          <v-btn color="primary" variant="flat" @click="saveCustom">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import SettingsDialog from './SettingsDialog.vue'
import ZipPanel from './ZipPanel.vue'
import { api } from '../composables/useApi'
import {
  LIVE,
  STATUS_COLOR,
  STATUS_TEXT,
  TYPE_TEXT,
  ago,
  runningCount,
} from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
  nodes: { type: Array, default: () => [] },
  currentNode: { type: String, default: '' },
})
const emit = defineEmits(['start', 'stop', 'save', 'setnode', 'scan', 'forget', 'notice'])

const tabs = [
  { value: 'service', title: '启动服务' },
  { value: 'package', title: '打包' },
  { value: 'install', title: '安装' },
  { value: 'zip', title: '压缩' },
]
const tab = ref('service')
const stopping = ref({})
const starting = ref({})

const settings = reactive({ on: false, svc: null, log: '', more: false, page: 0, logStatus: '' })
const custom = reactive({ on: false, path: '' })
const add = reactive({ on: false, saving: false, error: '', type: 'dev', action: '启动', tag: '', rel: '.', args: '', placeholder: '' })
let logSource = null

const ADD_META = {
  dev: { action: '启动', placeholder: 'npm run dev' },
  build: { action: '打包', placeholder: 'npm run build' },
  install: { action: '安装', placeholder: 'npm install' },
}
const TAB_TYPE = { service: 'dev', package: 'build', install: 'install' }

// 自定义命令可以指向工作区根，也可以指向某个子目录。
const scriptItems = computed(() =>
  props.ws.scripts.map((item) => ({ rel: item.rel, label: item.rel === '.' ? item.name : `${item.name}（${item.rel}）` })),
)

const CUSTOM = '__nodex_custom__'

const nodeItems = computed(() => {
  const items = [{ label: '跟随当前环境', path: '' }]
  for (const item of props.nodes) items.push({ label: item.label, path: item.path })
  // 存着但没扫到的路径也要列出来，否则下拉里看不到当前值。
  const cur = props.ws.node || ''
  if (cur && !props.nodes.some((item) => item.path === cur)) items.push({ label: cur, path: cur })
  items.push({ label: '自定义路径…', path: CUSTOM })
  return items
})

const nodeTitle = computed(() => {
  if (props.ws.node_missing) return `选中的 Node 已不存在，启动时回退到当前环境：${props.ws.node}`
  if (props.ws.node) return props.ws.node
  return props.currentNode ? `跟随当前环境：v${props.currentNode}` : '跟随启动服务时的环境'
})

function pickNode(value) {
  if (value === CUSTOM) {
    custom.path = props.ws.node || ''
    custom.on = true
    return
  }
  emit('setnode', { ws: props.ws.id, node: value })
}

function saveCustom() {
  emit('setnode', { ws: props.ws.id, node: custom.path.trim() })
  custom.on = false
}

const running = computed(() => runningCount(props.ws))

function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : full
}

function typeTab(type) {
  if (type === 'dev') return 'service'
  if (type === 'build') return 'package'
  return type
}

function count(value) {
  return props.ws.services.filter((s) => typeTab(s.type) === value).length
}

// 列表按栏目拼：每个动作只看自己的脚本，日志也从这一行打开。
const rows = computed(() => {
  return props.ws.services
    .filter((s) => typeTab(s.type) === tab.value)
    .map((svc) => {
      const run = svc.run
      const live = !!run && LIVE.includes(run.status)
      return {
        key: svc.id,
        svc,
        run,
        title: svc.tag,
        path: svc.display,
        cmd: svc.cmd,
        action: TYPE_TEXT[svc.type] || '执行',
        live,
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

function openAdd() {
  const type = TAB_TYPE[tab.value]
  const meta = ADD_META[type]
  add.on = true
  add.saving = false
  add.error = ''
  add.type = type
  add.action = meta.action
  add.placeholder = meta.placeholder
  add.tag = ''
  add.rel = props.ws.scripts.some((item) => item.rel === '.') ? '.' : (props.ws.scripts[0] || {}).rel || '.'
  add.args = ''
}

async function saveCommand() {
  const tag = add.tag.trim()
  const args = add.args.trim()
  if (!tag || !args) {
    add.error = '名称与命令都要填'
    return
  }
  add.saving = true
  add.error = ''
  try {
    await api.addCommand({ ws: props.ws.id, type: add.type, rel: add.rel, tag, args })
    add.on = false
    emit('scan')
  } catch (err) {
    add.error = err.message
  } finally {
    add.saving = false
  }
}

async function dropCommand(row) {
  if (!window.confirm(`删除自定义命令「${row.title}」？`)) return
  try {
    await api.removeCommand(row.svc.id)
    emit('scan')
  } catch (err) {
    emit('notice', err.message, 'error')
  }
}

function openSettings(row) {
  settings.svc = row.svc
  settings.log = ''
  settings.more = false
  settings.page = 0
  settings.logStatus = row.run ? STATUS_TEXT[row.run.status] || row.run.status : ''
  settings.on = true
  if (row.run) startLogStream(row.run.id)
  else closeLogStream()
}

function openLog(row) {
  if (!row.run) return
  settings.svc = row.svc || null
  settings.on = true
  settings.log = ''
  settings.more = false
  settings.page = 0
  settings.logStatus = row.run ? STATUS_TEXT[row.run.status] || row.run.status : ''
  startLogStream(row.run.id)
}

function closeLogStream() {
  if (logSource) {
    logSource.close()
    logSource = null
  }
}

// 先收尾部一页，之后文件有新行就追加；换运行号或关面板时断开。
function startLogStream(run) {
  closeLogStream()
  const source = new EventSource(api.logStreamUrl(run))
  logSource = source
  source.addEventListener('tail', (ev) => {
    const data = JSON.parse(ev.data)
    settings.log = data.text || ''
    settings.more = !!data.more
    settings.page = 0
  })
  source.addEventListener('append', (ev) => {
    const data = JSON.parse(ev.data)
    if (data.text) settings.log = settings.log ? `${settings.log}\n${data.text}` : data.text
  })
}

watch(
  () => settings.on,
  (on) => {
    if (!on) closeLogStream()
  },
)

// 状态轮询每两秒换一份 ws，日志弹窗里的状态跟着最新运行走。
watch(
  () => props.ws,
  () => {
    if (!settings.on || !settings.svc) return
    const svc = props.ws.services.find((s) => s.id === settings.svc.id)
    if (svc && svc.run) settings.logStatus = STATUS_TEXT[svc.run.status] || svc.run.status
  },
)

onBeforeUnmount(closeLogStream)

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

function onSave({ args }) {
  emit('save', { svc: settings.svc.id, args })
}
</script>

<style scoped>
/* 面板占满右侧剩下的高度：标题与栏目固定，表格自己滚。 */
.panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
.node-ver {
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
.count {
  margin-left: 6px;
}
.table {
  flex: 1 1 auto;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}
.status-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.status-chip {
  flex: 0 0 auto;
}
.status-line .meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
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
  font-family: inherit;
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
.add-error {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-error));
}
.none {
  padding: 28px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
