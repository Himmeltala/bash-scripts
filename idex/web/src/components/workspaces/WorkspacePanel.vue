<!--
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 00:59:41
 * @FilePath: \idex\web\src\components\workspaces\WorkspacePanel.vue
 * @Description: 工作区右侧的页签容器：按版本库与引擎能力切换变更、日志、同步、浏览与引擎页面。
-->

<template>
  <div class="wp">
    <div class="tabsbar">
      <v-tabs
        :model-value="shownTab"
        density="compact"
        color="primary"
        @update:model-value="tab = $event"
      >
        <v-tab v-for="name in tabs" :key="name" :value="name">
          <v-icon start size="18">{{ TAB_META[name].icon }}</v-icon>
          {{ TAB_META[name].label }}
          <v-chip v-if="name === 'changes' && count" class="badge" size="x-small" variant="flat" color="primary">
            {{ count }}
          </v-chip>
        </v-tab>
      </v-tabs>
    </div>

    <div class="tabbody">
      <ChangesPanel
        v-if="shownTab === 'changes'"
        :ws="ws"
        :refresh="changesKey"
        @loaded="count = $event"
      />
      <LogPanel v-else-if="shownTab === 'log'" :ws="ws" :refresh="repoKey" />
      <SyncPanel v-else-if="shownTab === 'sync'" :ws="ws" :refresh="repoKey" />
      <NodePanel v-else-if="shownTab === 'node'" :ws="ws" :focus="focus" />
      <JvmPanel v-else-if="shownTab === 'jvm'" :ws="ws" :focus="focus" />
      <BrowsePanel v-else :ws="ws" :refresh="changesKey" :changed-paths="changedPaths" />
    </div>
  </div>
</template>

<script>
// 自动探测按工作区记账；换走再回来会重建组件，这个集合让每个工作区只触发一次。
const detected = new Set()
</script>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
// 浏览页是默认页，随首屏一起打进来；其余三个面板按要看的页签再拉，首包小一截。
import BrowsePanel from '../browse/BrowsePanel.vue'

const ChangesPanel = defineAsyncComponent(() => import('../changes/ChangesPanel.vue'))
const LogPanel = defineAsyncComponent(() => import('../log/LogPanel.vue'))
const SyncPanel = defineAsyncComponent(() => import('../sync/SyncPanel.vue'))
// 引擎页签只在工作区真有这项能力时出现，面板按需再拉。
const NodePanel = defineAsyncComponent(() => import('../engines/NodePanel.vue'))
const JvmPanel = defineAsyncComponent(() => import('../engines/JvmPanel.vue'))
import { workspaceEventsUrl } from '../../utils/api'
import { toolsApi } from '../engines/toolApi'
import { needsToolDetection, workspaceTabs } from './workspaceTabs'
import { usePreferencesStore } from '../../stores/preferences'

const props = defineProps({
  ws: { type: Object, required: true },
  // 顶栏跳转带来的定位信息，交给引擎页签高亮对应行。
  focus: { type: Object, default: null },
})

// 页签标题与图标；顺序由 workspaceTabs 决定，这里只管怎么显示。
const TAB_META = {
  changes: { icon: 'mdi-file-compare', label: '变更' },
  log: { icon: 'mdi-history', label: '提交日志' },
  sync: { icon: 'mdi-cloud-sync-outline', label: '同步' },
  browse: { icon: 'mdi-folder-open-outline', label: '浏览目录' },
  node: { icon: 'mdi-nodejs', label: 'Node' },
  jvm: { icon: 'mdi-language-java', label: 'JVM' },
}

// 页签选择与查看方式一样记在全局偏好里，换工作副本也停在原处。
const preferences = usePreferencesStore()
const { activeTab: tab } = storeToRefs(preferences)
// 不是 SVN 工作副本或 Git 仓库时留浏览目录，探测到 Node 或 JVM 工程再加对应页签。
const tabs = computed(() => workspaceTabs(props.ws))
// 当前页签不可用时回到浏览目录；普通目录默认停在它，引擎页签按探测结果追加。
const shownTab = computed(() => {
  if (tabs.value.includes(tab.value)) return tab.value
  return tabs.value.includes('browse') ? 'browse' : tabs.value[0]
})

// 旧记录还没探测过引擎能力：切到这个工作区时自动补一次，失败就保持原样，
// 用户可以在页面里手动重扫。每个工作区只自动触发一次。
function detectTools() {
  if (!props.ws || !props.ws.id || !needsToolDetection(props.ws)) return
  if (detected.has(props.ws.id)) return
  detected.add(props.ws.id)
  toolsApi.rescan(props.ws.id).catch(() => {})
}
const count = ref(0)
// changes 只影响变更页；repo 是写操作结束，日志与同步信息也要重载。
const changesKey = ref(0)
// 这一轮变动的路径；浏览页只重读这些文件所在的目录。
const changedPaths = ref([])
const repoKey = ref(0)
let events = null

function closeEvents() {
  if (events) {
    events.close()
    events = null
  }
}

function openEvents() {
  closeEvents()
  // 页面在后台就不占着服务端的检查线程，回到前台再连，首推会补上这段变化。
  // 普通目录也连：服务端按目录项的大小与修改时间做指纹，浏览页同样能跟着刷新。
  if (!props.ws || !props.ws.id || document.hidden) return
  events = new EventSource(workspaceEventsUrl(props.ws.id))
  events.addEventListener('changes', (event) => {
    let data = {}
    try {
      data = JSON.parse(event.data)
    } catch (err) {
      data = {}
    }
    if (typeof data.count === 'number') count.value = data.count
    changedPaths.value = Array.isArray(data.paths) ? data.paths : []
    changesKey.value += 1
  })
  // 一次写操作结束，日志、同步信息与变更都可能变了。
  events.addEventListener('repo', () => {
    changedPaths.value = []
    changesKey.value += 1
    repoKey.value += 1
  })
  // 外面提交或更新过：日志与同步信息要重读。
  events.addEventListener('head', () => {
    repoKey.value += 1
  })
  // 连接断了 EventSource 会自己重连，不必在这里处理。
}

function onVisibility() {
  if (document.hidden) closeEvents()
  else openEvents()
}

// 换工作副本时清掉上一个目录的变更数，页签保持不动。
watch(
  () => props.ws.id,
  () => {
    count.value = 0
    changedPaths.value = []
    detectTools()
    openEvents()
  }
)
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  detectTools()
  openEvents()
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  closeEvents()
})
</script>

<style scoped>
.wp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.tabsbar {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.badge {
  margin-left: 6px;
}
/* 页签内容自己撑满剩余高度：外层用 flex 给高度，子面板不靠百分比，长差异才有得滚。
   六个页签统一套一层卡片，与左侧列表、引擎页签里的表格同一底色。 */
.tabbody {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 8px 8px 0;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
}
</style>
