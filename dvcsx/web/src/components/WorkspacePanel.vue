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
        <v-tab value="browse">
          <v-icon start size="18">mdi-folder-open-outline</v-icon>
          浏览目录
        </v-tab>
      </v-tabs>
    </div>

    <div class="tabbody">
      <ChangesPanel v-if="tab === 'changes'" :ws="ws" @loaded="count = $event" />
      <LogPanel v-else-if="tab === 'log'" :ws="ws" />
      <BrowsePanel v-else :ws="ws" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import BrowsePanel from './BrowsePanel.vue'
import ChangesPanel from './ChangesPanel.vue'
import LogPanel from './LogPanel.vue'

const props = defineProps({
  ws: { type: Object, required: true },
})

const tab = ref('changes')
const count = ref(0)

// 换工作副本时回到变更页，勾选状态不跟着带到另一个目录。
watch(
  () => props.ws.id,
  () => {
    tab.value = 'changes'
    count.value = 0
  }
)
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
