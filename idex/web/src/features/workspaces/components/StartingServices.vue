<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 00:56:55
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\workspaces\components\StartingServices.vue
 * @Description: 顶栏的运行中数量：定时取两个引擎的状态，点开列出服务，点一条跳到对应工作区与页签。
-->
<template>
  <v-menu v-if="items.length" location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        icon
        variant="text"
        :title="liveCount ? `${liveCount} 个服务在运行` : '最近运行过的服务'"
      >
        <v-badge v-if="liveCount" :content="liveCount" color="primary">
          <v-icon>mdi-play-circle-outline</v-icon>
        </v-badge>
        <v-icon v-else>mdi-play-circle-outline</v-icon>
      </v-btn>
    </template>
    <v-list density="compact" class="menu" max-height="420">
      <v-list-item
        v-for="item in items"
        :key="item.key"
        @click="emit('open', item)"
      >
        <v-list-item-title>{{ item.service }}</v-list-item-title>
        <v-list-item-subtitle class="meta">
          {{ item.label }}
          <v-chip size="x-small" variant="tonal" :color="item.actionColor" class="action-chip">
            {{ item.actionText }}
          </v-chip>
        </v-list-item-subtitle>
        <!-- 路径单独一行完整显示，同名模块靠它区分。 -->
        <div class="path">{{ item.path }}</div>
        <template #prepend>
          <v-icon :color="item.color">{{ item.icon }}</v-icon>
        </template>
        <template #append>
          <v-chip size="x-small" variant="tonal" :color="item.color" class="mr-1">
            {{ item.statusText }}
          </v-chip>
          <!-- 和 IDEA 一样：列表里直接启动/停止，不必先切到工作区再找服务。 -->
          <v-btn
            v-if="item.live"
            icon="mdi-stop"
            size="x-small"
            variant="text"
            title="停止"
            :loading="!!stopping[item.key]"
            :disabled="item.status === 'stopping'"
            @click.stop="halt(item)"
          />
          <v-btn
            v-else
            icon="mdi-play"
            size="x-small"
            variant="text"
            title="启动"
            :loading="!!starting[item.key]"
            @click.stop="run(item)"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { baseName } from '../../../utils/format'
import { STATUS_COLOR, STATUS_TEXT } from '../../engines/lib/serviceStatus'
import { jvmApi, nodeApi } from '../../engines/lib/toolApi'
import { toast } from '../../../utils/notice'

const props = defineProps({
  workspaces: { type: Array, default: () => [] },
})
const emit = defineEmits(['open'])

// 只取两个引擎的运行清单，不拉整份状态：整份要拼所有工作区与服务，这里只要「跑过什么」。
// 走定时 GET，不占同源的第 7 条长连接：浏览器每个源只给 6 条 HTTP/1.1 连接，
// 全局状态、指标、工作区事件与页签推送已经用掉 4 到 6 条。
const engines = ref({ node: [], jvm: [] })
const POLL_MS = 3000
let timer = null
let busy = false

async function refresh() {
  if (busy) return
  busy = true
  try {
    const [node, jvm] = await Promise.all([nodeApi.runs(), jvmApi.runs()])
    engines.value = {
      node: (node && node.runs) || [],
      jvm: (jvm && jvm.runs) || [],
    }
  } catch (err) {
    // 引擎没起来时下一轮再取。
  } finally {
    busy = false
  }
}

function startPolling() {
  stopPolling()
  refresh()
  timer = setInterval(refresh, POLL_MS)
}

function stopPolling() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function onVisibility() {
  if (document.hidden) stopPolling()
  else startPolling()
}

onMounted(() => {
  startPolling()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  stopPolling()
})

// 引擎工作区 id 找回 idex 里的工作区；同一引擎根登记了多个时取第一个。
function ownerOf(kind, engineId) {
  for (const ws of props.workspaces) {
    const tool = ws.tools && ws.tools[kind]
    if (tool && tool.id === engineId) return ws
  }
  return null
}

// 列表里排的是「运行过」的服务：在跑的排前面，停掉的留在后面可以一键再启动。
const RECENT_LIMIT = 20
// 同一个模块的启动、打包、安装名字相同，用 chip 分开；颜色与引擎页签的类型列一致。
const ACTIONS = {
  run: { text: '启动', color: 'primary' },
  war: { text: '启动', color: 'primary' },
  dev: { text: '启动', color: 'primary' },
  package: { text: '打包', color: 'warning' },
  build: { text: '打包', color: 'warning' },
  install: { text: '安装', color: 'success' },
}
const liveCount = computed(() => items.value.filter((item) => item.live).length)

const items = computed(() => {
  const out = []
  for (const kind of ['node', 'jvm']) {
    const name = kind === 'node' ? 'Node' : 'JVM'
    const icon = kind === 'node' ? 'mdi-nodejs' : 'mdi-language-java'
    for (const run of engines.value[kind] || []) {
      const owner = ownerOf(kind, run.ws)
      if (!owner) continue
      const status = run.status
      const live = status === 'starting' || status === 'ready' || status === 'stopping'
      const service = run.tag || run.display || run.svc
      const workspace = owner.alias || baseName(owner.root)
      const action = ACTIONS[run.type] || { text: run.type || '执行', color: 'grey' }
      out.push({
        key: `${kind}:${run.svc}`,
        kind,
        wsId: owner.id,
        svcId: run.svc,
        runId: run.id,
        status,
        live,
        icon,
        service,
        label: [name, workspace].filter(Boolean).join(' · '),
        path: owner.root || '',
        actionText: action.text,
        actionColor: action.color,
        statusText: STATUS_TEXT[status] || status,
        color: STATUS_COLOR[status] || 'grey',
        started: Number(run.started || 0),
      })
    }
  }
  out.sort((a, b) => Number(b.live) - Number(a.live) || b.started - a.started)
  return out.slice(0, RECENT_LIMIT)
})

const starting = reactive({})
const stopping = reactive({})

// 启动/停止走两个引擎各自的接口：参数用上次存下的，不在这里改。
async function run(item) {
  starting[item.key] = true
  try {
    await (item.kind === 'node' ? nodeApi : jvmApi).start({ svc: item.svcId })
    toast('已发出启动', 'primary')
    await refresh()
  } catch (err) {
    toast(`启动失败：${err.message}`, 'error')
  } finally {
    delete starting[item.key]
  }
}

async function halt(item) {
  stopping[item.key] = true
  try {
    await (item.kind === 'node' ? nodeApi : jvmApi).stop(item.runId)
    toast('已发出停止', 'primary')
    await refresh()
  } catch (err) {
    toast(`停止失败：${err.message}`, 'error')
  } finally {
    delete stopping[item.key]
  }
}
</script>

<style scoped>
.menu {
  min-width: 380px;
  max-width: 620px;
}
/* 动作 chip 跟在「JVM · 工作区」这一行，不与状态混在一起。 */
.action-chip {
  margin-left: 6px;
  height: 18px;
}
/* 路径整行换行显示，不截断。 */
.path {
  margin-top: 2px;
  font-size: 0.72rem;
  line-height: 1.35;
  opacity: 0.6;
  word-break: break-all;
}
/* 服务名与右侧状态标签之间留出空隙。 */
.menu :deep(.v-list-item__content) {
  padding-right: 12px;
}
</style>
