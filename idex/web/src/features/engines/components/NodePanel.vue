<!--
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 18:40:00
 * @FilePath: \idex\web\src\features\engines\components\NodePanel.vue
 * @Description: Node 页签：扫描 package.json 脚本，在同一张表里启动、停止并管理自定义命令。
-->

<template>
  <div class="panel">
    <header class="head">
      <div class="titles">
        <h2>{{ baseName(root) }}</h2>
        <p class="root" :title="root">{{ root }}</p>
      </div>
      <div v-if="registered" class="actions">
        <v-select
          :model-value="engineWs.node || ''"
          :items="nodeItems"
          item-title="label"
          item-value="path"
          label="Node"
          density="compact"
          variant="outlined"
          hide-details
          class="node-ver"
          :prepend-inner-icon="engineWs.node_missing ? 'mdi-alert' : 'mdi-nodejs'"
          :title="nodeTitle"
          @update:model-value="pickNode"
        />
        <v-chip size="small" variant="tonal">{{ scripts.length }} 个脚本</v-chip>
        <v-chip v-if="running" size="small" color="ready" variant="tonal">{{ running }} 个在跑</v-chip>
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" :loading="scanning" @click="rescan">
          重新扫描
        </v-btn>
      </div>
    </header>

    <EngineRegisterState
      v-if="!registered"
      :loading="loading"
      :error="error"
      :waiting="waiting"
      :enabling="enabling"
      :enable-error="enableError"
      :labels="ENGINE_LABELS"
      @retry="retry"
      @enable="enable"
    />

    <template v-else>
      <div v-if="error" class="banner">
        <v-icon size="18" color="warning">mdi-alert</v-icon>
        <span>{{ error }}</span>
        <v-spacer />
        <v-btn size="small" variant="text" @click="retry">重试</v-btn>
      </div>

      <div class="toolbar">
        <span class="section">脚本</span>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="openAdd">添加命令</v-btn>
      </div>

      <EmptyState
        v-if="!rows.length"
        icon="mdi-console-line"
        :icon-size="44"
        title="没有可执行的脚本"
        hint="可以添加一条自己的命令。"
      />

      <ServiceTable
        v-else
        :rows="rows"
        name-title="脚本"
        :show-path="false"
        show-restart
        :focus-id="focus && focus.kind === 'node' ? focus.svcId : ''"
        :focus-seq="focus ? focus.seq : 0"
        @start="start"
        @stop="stop"
        @restart="restart"
        @settings="openSettings"
        @log="openLog"
      >
        <template #row-extra="{ row }">
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
        </template>
      </ServiceTable>
    </template>

    <FloatingDialog
      v-model="add.on"
      :initial-width="540"
      :initial-height="560"
      :min-width="420"
      :min-height="320"
    >
      <template #title>添加命令</template>
      <v-select
        v-model="add.type"
        :items="typeItems"
        item-title="title"
        item-value="value"
        label="类型"
        density="compact"
        variant="outlined"
        class="mb-4"
      />
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
        :placeholder="addPlaceholder"
        density="compact"
        variant="outlined"
        @keyup.enter="saveCommand"
      />
      <p v-if="add.error" class="add-error">{{ add.error }}</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="add.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :loading="add.saving" @click="saveCommand">保存</v-btn>
      </template>
    </FloatingDialog>

    <NodeSettingsDialog
      v-model="settings.on"
      :svc="settings.svc"
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
      <template #title>自定义 Node</template>
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
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="custom.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" @click="saveCustom">保存</v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { EmptyState } from '@bash-scripts/web-shared/layouts'
import EngineRegisterState from './EngineRegisterState.vue'
import NodeSettingsDialog from './NodeSettingsDialog.vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import {
  LIVE_STATUSES,
  ServiceTable,
  runningCount,
  serviceIcon,
  useServiceActions,
} from '@bash-scripts/web-shared'
import { formatAgo as ago } from '@bash-scripts/web-shared/format'
import { baseName } from '../../../utils/format'
import { STATUS_COLOR, STATUS_TEXT } from '../lib/serviceStatus'
import { nodeApi, toolsApi } from '../lib/toolApi'
import { useToolWorkspace } from '../composables/useToolWorkspace'
import { useEngineEnable } from '../composables/useEngineEnable'
import { toast } from '../../../utils/notice'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
  // 顶栏点「正在启动」跳过来时，定位到具体一行。
  focus: { type: Object, default: null },
})

// Node 的脚本不分栏：dev/build/install 只是扫描时的归类，一张表加类型标签就够。
const TYPE_TEXT = {
  dev: '启动',
  build: '打包',
  install: '安装',
}
// 类型列的颜色：启动蓝、打包橙、安装绿。
const TYPE_COLOR = {
  dev: 'primary',
  build: 'warning',
  install: 'success',
}
const LIVE = LIVE_STATUSES

const ENGINE_LABELS = {
  engine: 'Node',
  listHint: '取到引擎状态后就会列出这个工作区的脚本。',
  project: 'Node 工程',
  scanHint: '启用后会登记并扫描脚本。',
  waitHint: '已发出启用，扫描完成后这里会自动列出脚本。',
}

// 引擎工作区由 idex 探测结果里的 id 定位，状态走 Node 引擎自己的推送。
const engineId = computed(() => {
  const tools = props.ws.tools
  const node = tools && typeof tools === 'object' ? tools.node : null
  return (node && node.id) || ''
})

const { ws: engineWs, registered, loading, error, reload } = useToolWorkspace({
  api: nodeApi,
  engineId: () => engineId.value,
  localApi: toolsApi,
  localId: () => props.ws.id,
})

const root = computed(() => {
  if (engineWs.value && engineWs.value.root) return engineWs.value.root
  const node = props.ws.tools && props.ws.tools.node
  return (node && node.root) || props.ws.root
})
const scripts = computed(() => (engineWs.value && engineWs.value.scripts) || [])
const services = computed(() => (engineWs.value && engineWs.value.services) || [])
const running = computed(() => (engineWs.value ? runningCount(engineWs.value) : 0))

// 引擎登记、扫描等待与重试走共享流程，只有超时文案是本页签自己的。
const { enabling, waiting, enableError, enable, retry } = useEngineEnable({
  toolsApi,
  engineApi: nodeApi,
  wsId: () => props.ws.id,
  registered,
  error,
  reload,
  rescanStatus: (id) => nodeApi.rescanStatus(id),
  timeoutText: '扫描超过两分钟还没回来；检查 Node 引擎后重试。',
})

const scanning = ref(false)
const custom = reactive({ on: false, path: '' })
const add = reactive({ on: false, saving: false, error: '', type: 'dev', tag: '', rel: '.', args: '' })
const nodes = ref([])
const currentNode = ref('')

// 启动、停止与设置弹窗走共享流程，只有启动载荷是本应用自己的。
const {
  starting,
  stopping,
  settings,
  logText,
  logMore,
  logStatus,
  loadMoreLog,
  start,
  stop,
  openSettings,
  openLog,
} = useServiceActions({
  ws: () => engineWs.value,
  api: nodeApi,
  statusText: STATUS_TEXT,
  startPayload: (row) => ({ svc: row.svc.id }),
  onStart: (payload) => startService(payload),
  onStop: (runId) => stopService(runId),
})

// 类型下拉与命令提示按同一组顺序排，添加时自己选类型。
const TYPE_ORDER = Object.keys(TYPE_TEXT)
const typeItems = TYPE_ORDER.map((type) => ({ value: type, title: TYPE_TEXT[type] }))
const ADD_PLACEHOLDER = { dev: 'npm run dev', build: 'npm run build', install: 'npm install' }
const addPlaceholder = computed(() => ADD_PLACEHOLDER[add.type] || '')

// 自定义命令可以指向工作区根，也可以指向某个子目录。
const scriptItems = computed(() =>
  scripts.value.map((item) => ({
    rel: item.rel,
    label: item.rel === '.' ? item.name : `${item.name}（${item.rel}）`,
  })),
)

const CUSTOM = '__idex_custom__'

const nodeItems = computed(() => {
  const items = [{ label: '跟随当前环境', path: '' }]
  for (const item of nodes.value) items.push({ label: item.label, path: item.path })
  // 存着但没扫到的路径也要列出来，否则下拉里看不到当前值。
  const cur = (engineWs.value && engineWs.value.node) || ''
  if (cur && !nodes.value.some((item) => item.path === cur)) items.push({ label: cur, path: cur })
  items.push({ label: '自定义路径…', path: CUSTOM })
  return items
})

const nodeTitle = computed(() => {
  const cur = engineWs.value ? engineWs.value.node : ''
  if (engineWs.value && engineWs.value.node_missing) {
    return `选中的 Node 已不存在，启动时回退到当前环境：${cur}`
  }
  if (cur) return cur
  return currentNode.value ? `跟随当前环境：v${currentNode.value}` : '跟随启动服务时的环境'
})

async function loadNodes() {
  try {
    const data = await nodeApi.nodes()
    nodes.value = data.nodes || []
    currentNode.value = data.current || ''
  } catch (err) {
    // 取不到只是下拉里没有候选，手动填路径仍然可用。
  }
}

async function pickNode(value) {
  if (value === CUSTOM) {
    custom.path = (engineWs.value && engineWs.value.node) || ''
    custom.on = true
    return
  }
  await setNode(value)
}

async function setNode(node) {
  try {
    await nodeApi.setNode(props.ws.id, node)
    toast(node ? 'Node 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
  } catch (err) {
    toast(`设置 Node 失败：${err.message}`, 'error')
  }
}

async function saveCustom() {
  await setNode(custom.path.trim())
  custom.on = false
}

async function rescan() {
  scanning.value = true
  try {
    await nodeApi.rescan(props.ws.id)
    toast('已开始重新扫描', 'primary')
  } catch (err) {
    toast(`重新扫描失败：${err.message}`, 'error')
  } finally {
    scanning.value = false
  }
}

async function startService(payload) {
  try {
    await nodeApi.start(payload)
    toast('已发出启动', 'primary')
  } catch (err) {
    toast(`启动失败：${err.message}`, 'error')
  }
}

async function stopService(runId) {
  try {
    await nodeApi.stop(runId)
    toast('已发出停止', 'primary')
  } catch (err) {
    toast(`停止失败：${err.message}`, 'error')
  }
}

// 重启按钮的短暂忙碌态；真正的停止与重新启动在引擎里完成，状态由推送补上。
const restarting = ref({})

async function restart(row) {
  const id = row.svc.id
  restarting.value[id] = true
  try {
    await nodeApi.restart(row.run.id)
    toast('已发出重启', 'primary')
  } catch (err) {
    toast(`重启失败：${err.message}`, 'error')
  } finally {
    delete restarting.value[id]
  }
}

function typeRank(type) {
  const rank = TYPE_ORDER.indexOf(type)
  return rank < 0 ? TYPE_ORDER.length : rank
}

// 一张表按类型分组排：启动在前、构建其次、安装最后，同类型按名字。
const rows = computed(() => {
  // 同一工作区里的安装只能串行：包管理器的存储与锁文件只有一份。
  const installLive = services.value.some(
    (svc) => svc.type === 'install' && svc.run && LIVE.includes(svc.run.status),
  )
  return services.value
    .slice()
    .sort((a, b) => typeRank(a.type) - typeRank(b.type) || String(a.tag).localeCompare(String(b.tag), 'zh-CN'))
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
        typeText: TYPE_TEXT[svc.type] || '',
        typeColor: TYPE_COLOR[svc.type] || 'grey',
        action: TYPE_TEXT[svc.type] || '执行',
        live,
        blocked: svc.type === 'install' && installLive,
        statusText: run ? STATUS_TEXT[run.status] || run.status : '',
        color: run ? STATUS_COLOR[run.status] || 'grey' : 'grey',
        icon: run ? serviceIcon(run.status) : 'mdi-circle-outline',
        err: run && run.err,
        port: run && run.port,
        started: run && run.started,
        ago: run ? ago(run.started) : '',
        stopping: !!stopping.value[svc.id],
        starting: !!starting.value[svc.id],
        restarting: !!restarting.value[svc.id],
      }
    })
})

function openAdd() {
  add.on = true
  add.saving = false
  add.error = ''
  add.type = 'dev'
  add.tag = ''
  add.rel = scripts.value.some((item) => item.rel === '.') ? '.' : (scripts.value[0] || {}).rel || '.'
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
    await nodeApi.addCommand({ ws: props.ws.id, type: add.type, rel: add.rel, tag, args })
    add.on = false
    await rescan()
  } catch (err) {
    add.error = err.message
  } finally {
    add.saving = false
  }
}

async function dropCommand(row) {
  if (!window.confirm(`删除自定义命令「${row.title}」？`)) return
  try {
    await nodeApi.removeCommand(row.svc.id)
    await rescan()
  } catch (err) {
    toast(`删除失败：${err.message}`, 'error')
  }
}

async function onSave({ args }) {
  if (!settings.svc) return
  try {
    await nodeApi.update({ svc: settings.svc.id, args })
    toast('参数已保存', 'primary')
  } catch (err) {
    toast(`保存参数失败：${err.message}`, 'error')
  }
}

// 换工作区时收起自定义 Node 弹窗；启用请求与等待由共享流程按工作区作废。
watch(
  () => props.ws.id,
  () => {
    custom.on = false
  },
)

onMounted(loadNodes)
</script>

<style scoped>
/* 面板占满右侧剩下的高度：标题与状态固定，表格自己滚。 */
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
.node-ver {
  max-width: 240px;
  min-width: 170px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 14px 0 10px;
  flex-wrap: wrap;
}
.section {
  font-size: 0.85rem;
  font-weight: 500;
}
.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 0.82rem;
  background: rgba(var(--v-theme-warning), 0.12);
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
