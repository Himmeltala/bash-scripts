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
      <v-btn v-bind="menuProps" icon variant="text" :title="`${items.length} 个服务在运行`">
        <v-badge :content="items.length" color="primary">
          <v-icon>mdi-play-circle-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>
    <v-list density="compact" class="menu" max-height="360">
      <v-list-item
        v-for="item in items"
        :key="item.key"
        :title="item.service"
        :subtitle="item.label"
        @click="emit('open', item)"
      >
        <template #prepend>
          <v-icon :color="item.color">{{ item.icon }}</v-icon>
        </template>
        <template #append>
          <v-chip size="x-small" variant="tonal" :color="item.color">{{ item.statusText }}</v-chip>
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { baseName } from '../../../utils/format'
import { STATUS_COLOR, STATUS_TEXT } from '../../engines/lib/serviceStatus'
import { jvmApi, nodeApi } from '../../engines/lib/toolApi'

const props = defineProps({
  workspaces: { type: Array, default: () => [] },
})
const emit = defineEmits(['open'])

// 两个引擎各取一份全量状态。这里用定时 GET，不占同源的第 7 条长连接：
// 浏览器每个源只给 6 条 HTTP/1.1 连接，全局状态、指标、工作区事件与页签推送已经用掉 4 到 6 条。
const engines = ref({ node: { workspaces: [] }, jvm: { workspaces: [] } })
const POLL_MS = 3000
let timer = null
let busy = false

async function refresh() {
  if (busy) return
  busy = true
  try {
    const [node, jvm] = await Promise.all([nodeApi.state(), jvmApi.state()])
    engines.value = {
      node: node || { workspaces: [] },
      jvm: jvm || { workspaces: [] },
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

const items = computed(() => {
  const out = []
  for (const kind of ['node', 'jvm']) {
    const name = kind === 'node' ? 'Node' : 'JVM'
    const icon = kind === 'node' ? 'mdi-nodejs' : 'mdi-language-java'
    for (const ws of engines.value[kind].workspaces || []) {
      const owner = ownerOf(kind, ws.id)
      if (!owner) continue
      for (const svc of ws.services || []) {
        const status = svc.run && svc.run.status
        if (status !== 'starting' && status !== 'ready') continue
        const service = svc.tag || svc.display || svc.id
        const workspace = owner.alias || baseName(owner.root)
        out.push({
          key: `${kind}:${svc.id}:${svc.run.id}`,
          kind,
          wsId: owner.id,
          svcId: svc.id,
          icon,
          service,
          label: `${name} · ${workspace}`,
          statusText: STATUS_TEXT[status] || status,
          color: STATUS_COLOR[status] || 'grey',
        })
      }
    }
  }
  return out
})
</script>

<style scoped>
.menu {
  min-width: 260px;
  max-width: 420px;
}
/* 服务名与右侧状态标签之间留出空隙。 */
.menu :deep(.v-list-item__content) {
  padding-right: 12px;
}
</style>
