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

    <div v-if="error && !registered" class="state">
      <v-icon size="28" color="error">mdi-server-off</v-icon>
      <div class="state-text">
        <strong>Node 引擎不可用</strong>
        <p>{{ error }}</p>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="reload">重试</v-btn>
    </div>

    <div v-else-if="loading && !registered" class="state">
      <v-progress-circular indeterminate size="20" />
      <div class="state-text">
        <strong>正在连接 Node 引擎</strong>
        <p>取到引擎状态后就会列出这个工作区的脚本。</p>
      </div>
    </div>

    <div v-else-if="!registered" class="state">
      <v-icon size="28">mdi-power-plug-off-outline</v-icon>
      <div class="state-text">
        <strong>引擎里还没有这个工作区</strong>
        <p>idex 已经识别出 Node 工程，但引擎的状态文件里还没有登记。启用后会登记并扫描脚本。</p>
        <p v-if="waiting" class="state-wait">已发出启用，扫描完成后这里会自动列出脚本。</p>
        <p v-if="enableError" class="state-error">{{ enableError }}</p>
      </div>
      <v-btn color="primary" variant="flat" :loading="enabling" :disabled="waiting" @click="enable">
        {{ waiting ? '扫描中' : '启用并扫描' }}
      </v-btn>
    </div>

    <template v-else>
      <div v-if="error" class="banner">
        <v-icon size="18" color="warning">mdi-alert</v-icon>
        <span>{{ error }}</span>
        <v-spacer />
        <v-btn size="small" variant="text" @click="reload">重试</v-btn>
      </div>

      <div class="toolbar">
        <span class="section">脚本</span>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="openAdd">添加命令</v-btn>
      </div>

      <!-- 脚本一多，一堆 dev 变体与同名 build 混在一张表里不好找；超过两屏再给一排按类型的筛选。 -->
      <div v-if="filterable" class="filters">
        <v-chip
          v-for="item in filters"
          :key="item.value"
          size="small"
          :variant="filter === item.value ? 'flat' : 'text'"
          :color="filter === item.value ? 'primary' : undefined"
          @click="filter = item.value"
        >
          {{ item.title }}<span class="filter-count">{{ item.count }}</span>
        </v-chip>
      </div>

      <div v-if="!rows.length" class="none">
        这个工作区没有可执行的脚本；换一条筛选看看，或者添加一条自己的命令。
      </div>

      <ServiceTable
        v-else
        :rows="rows"
        name-title="脚本"
        :show-path="false"
        @start="start"
        @stop="stop"
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

    <SettingsDialog
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
import SettingsDialog from './SettingsDialog.vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import {
  LIVE_STATUSES,
  ServiceTable,
  runningCount,
  serviceIcon,
  useServiceActions,
} from '@bash-scripts/web-shared'
import { formatAgo as ago } from '@bash-scripts/web-shared/format'
import { baseName } from '../../utils/format'
import { nodeApi, toolsApi } from '../../utils/toolApi'
import { useToolWorkspace } from '../../composables/useToolWorkspace'
import { toast } from '../../utils/notice'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
})

// Node 的脚本不分栏：dev/build/install 只是扫描时的归类，一张表加类型标签就够。
const TYPE_TEXT = {
  dev: '启动',
  build: '打包',
  install: '安装',
}
const STATUS_TEXT = {
  starting: '启动中',
  ready: '运行中',
  exited: '已结束',
  failed: '失败',
  stopped: '已停止',
}
const STATUS_COLOR = {
  starting: 'warning',
  ready: 'ready',
  exited: 'grey',
  failed: 'failed',
  stopped: 'grey',
}
const LIVE = LIVE_STATUSES

// 引擎工作区由 idex 探测结果里的 id 定位，状态走 Node 引擎自己的推送。
const engineId = computed(() => {
  const tools = props.ws.tools
  const node = tools && typeof tools === 'object' ? tools.node : null
  return (node && node.id) || ''
})

const { ws: engineWs, registered, loading, error, refresh, reload } = useToolWorkspace({
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

const filter = ref('')
const scanning = ref(false)
const enabling = ref(false)
const waiting = ref(false)
const enableError = ref('')
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

const CUSTOM = '__nodex_custom__'

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
    await refresh()
  } catch (err) {
    toast(`设置 Node 失败：${err.message}`, 'error')
  }
}

async function saveCustom() {
  await setNode(custom.path.trim())
  custom.on = false
}

// 「启用并扫描」：idex 再探测一次能力，引擎按根目录登记并扫描；结果由状态推送补上。
// 只调 tools 的探测不会往引擎状态里写工作区行，所以两条都要走。
async function enable() {
  enabling.value = true
  enableError.value = ''
  try {
    await Promise.all([toolsApi.rescan(props.ws.id), nodeApi.rescan(props.ws.id)])
    waiting.value = true
    await reload()
  } catch (err) {
    enableError.value = err.message
  } finally {
    enabling.value = false
  }
}

// 扫描结果由状态推送带回来：工作区一出现就不用再等。
watch(registered, (on) => {
  if (on) {
    waiting.value = false
    enableError.value = ''
  }
})

async function rescan() {
  scanning.value = true
  try {
    await nodeApi.rescan(props.ws.id)
    toast('已开始重新扫描', 'primary')
    await refresh()
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
    await refresh()
  } catch (err) {
    toast(`启动失败：${err.message}`, 'error')
  }
}

async function stopService(runId) {
  try {
    await nodeApi.stop(runId)
    toast('已停止', 'primary')
    await refresh()
  } catch (err) {
    toast(`停止失败：${err.message}`, 'error')
  }
}

// 超过两屏才给筛选，三五行的时候多一排按钮反而添乱。
const filterable = computed(() => services.value.length > 8)

const filters = computed(() => {
  const items = [{ value: '', title: '全部', count: services.value.length }]
  for (const type of TYPE_ORDER) {
    const count = services.value.filter((s) => s.type === type).length
    if (count) items.push({ value: type, title: TYPE_TEXT[type], count })
  }
  return items
})

function typeRank(type) {
  const rank = TYPE_ORDER.indexOf(type)
  return rank < 0 ? TYPE_ORDER.length : rank
}

// 一张表按类型分组排：启动在前、构建其次、安装最后，同类型按名字。
const rows = computed(() => {
  return services.value
    .filter((s) => !filter.value || s.type === filter.value)
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
        action: TYPE_TEXT[svc.type] || '执行',
        live,
        statusText: run ? STATUS_TEXT[run.status] || run.status : '',
        color: run ? STATUS_COLOR[run.status] || 'grey' : 'grey',
        icon: run ? serviceIcon(run.status) : 'mdi-circle-outline',
        err: run && run.err,
        port: run && run.port,
        started: run && run.started,
        ago: run ? ago(run.started) : '',
        stopping: !!stopping.value[svc.id],
        starting: !!starting.value[svc.id],
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
    await refresh()
  } catch (err) {
    toast(`保存参数失败：${err.message}`, 'error')
  }
}

// 换工作区时筛选回到全部，否则表里只剩空行，看着像脚本丢了。
watch(
  () => props.ws.id,
  () => {
    filter.value = ''
    custom.on = false
    enableError.value = ''
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
.filters {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: -2px 0 8px;
}
.filter-count {
  margin-left: 6px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.state {
  flex: 1 1 auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.state-text {
  flex: 1 1 auto;
  min-width: 0;
}
.state-text strong {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.95rem;
}
.state-text p {
  margin: 4px 0 0;
  font-size: 0.82rem;
}
.state-error {
  color: rgb(var(--v-theme-error));
}
.state-wait {
  color: rgb(var(--v-theme-primary));
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
