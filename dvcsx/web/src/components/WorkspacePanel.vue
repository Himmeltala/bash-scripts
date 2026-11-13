<template>
  <div class="wp">
    <div class="tabsbar">
      <v-tabs v-model="tab" density="compact" color="primary">
        <v-tab value="changes">
          <v-icon start size="18">mdi-file-compare</v-icon>
          变更
          <v-chip v-if="count" class="badge" size="x-small" variant="flat" color="primary">
            {{ count }}
          </v-chip>
        </v-tab>
        <v-tab value="log">
          <v-icon start size="18">mdi-history</v-icon>
          提交日志
        </v-tab>
        <v-tab value="sync">
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
        v-if="tab === 'changes'"
        :ws="ws"
        :refresh="changesKey"
        @loaded="count = $event"
      />
      <LogPanel v-else-if="tab === 'log'" :ws="ws" :refresh="repoKey" />
      <SyncPanel v-else-if="tab === 'sync'" :ws="ws" :refresh="repoKey" />
      <BrowsePanel v-else :ws="ws" />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BrowsePanel from './BrowsePanel.vue'
import ChangesPanel from './ChangesPanel.vue'
import LogPanel from './LogPanel.vue'
import SyncPanel from './SyncPanel.vue'
import { workspaceEventsUrl } from '../composables/useApi'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps({
  ws: { type: Object, required: true },
})

// 页签选择与查看方式一样记在全局偏好里，换工作副本也停在原处。
const preferences = usePreferencesStore()
const { activeTab: tab } = storeToRefs(preferences)
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
  if (!props.ws || !props.ws.id) return
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
  // 连接断了 EventSource 会自己重连，不必在这里处理。
}

// 换工作副本时清掉上一个目录的变更数，页签保持不动。
watch(
  () => props.ws.id,
  () => {
    count.value = 0
    openEvents()
  }
)
onMounted(openEvents)
onBeforeUnmount(closeEvents)
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
