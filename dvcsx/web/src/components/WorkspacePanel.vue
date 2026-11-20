<template>
  <div class="wp">
    <div class="tabsbar">
      <v-tabs
        :model-value="shownTab"
        density="compact"
        color="primary"
        @update:model-value="tab = $event"
      >
        <v-tab v-if="!plain" value="changes">
          <v-icon start size="18">mdi-file-compare</v-icon>
          变更
          <v-chip v-if="count" class="badge" size="x-small" variant="flat" color="primary">
            {{ count }}
          </v-chip>
        </v-tab>
        <v-tab v-if="!plain" value="log">
          <v-icon start size="18">mdi-history</v-icon>
          提交日志
        </v-tab>
        <v-tab v-if="!plain" value="sync">
          <v-icon start size="18">mdi-cloud-sync-outline</v-icon>
          同步
        </v-tab>
        <v-tab value="browse">
          <v-icon start size="18">mdi-folder-open-outline</v-icon>
          浏览目录
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
      <BrowsePanel v-else :ws="ws" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BrowsePanel from './BrowsePanel.vue'
import ChangesPanel from './ChangesPanel.vue'
import LogPanel from './LogPanel.vue'
import SyncPanel from './SyncPanel.vue'
import { workspaceEventsUrl } from '../utils/api'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps({
  ws: { type: Object, required: true },
})

// 页签选择与查看方式一样记在全局偏好里，换工作副本也停在原处。
const preferences = usePreferencesStore()
const { activeTab: tab } = storeToRefs(preferences)
// 不是 SVN 工作副本或 Git 仓库时只留浏览目录，别的页签没有东西可查。
const plain = computed(() => props.ws.vcs !== 'git' && props.ws.vcs !== 'svn')
const shownTab = computed(() => (plain.value ? 'browse' : tab.value))
const count = ref(0)
// changes 只影响变更页；repo 是写操作结束，日志与同步信息也要重载。
const changesKey = ref(0)
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
  // 普通目录没有版本控制可查，不用连这条推送。
  if (!props.ws || !props.ws.id || plain.value || document.hidden) return
  events = new EventSource(workspaceEventsUrl(props.ws.id))
  events.addEventListener('changes', (event) => {
    let data = {}
    try {
      data = JSON.parse(event.data)
    } catch (err) {
      data = {}
    }
    if (typeof data.count === 'number') count.value = data.count
    changesKey.value += 1
  })
  // 一次写操作结束，日志、同步信息与变更都可能变了。
  events.addEventListener('repo', () => {
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
    openEvents()
  }
)
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
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
/* 页签内容自己撑满剩余高度：外层用 flex 给高度，子面板不靠百分比，长差异才有得滚。 */
.tabbody {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
