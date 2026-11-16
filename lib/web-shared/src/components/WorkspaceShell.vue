<template>
  <v-app>
    <v-app-bar density="comfortable" flat border="b" class="app-bar">
      <v-app-bar-title>
        <span class="brand">{{ title }}</span>
      </v-app-bar-title>
      <v-spacer />
      <v-chip
        v-if="workspaces.length"
        size="small"
        variant="tonal"
        class="running"
        :color="running ? 'ready' : undefined"
        prepend-icon="mdi-play-circle-outline"
        :title="running ? `所有工作区共 ${running} 个进程在跑` : '所有工作区都没有在跑的进程'"
      >
        {{ running }} 个在跑
      </v-chip>
      <slot name="metrics" />
      <v-btn
        :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        title="切换深浅色"
        variant="text"
        @click="toggleTheme"
      />
    </v-app-bar>

    <ToastHost v-model="snack.on" :text="snack.text" :color="snack.color" />

    <v-main class="fill-height">
      <div ref="shellRef" class="shell">
        <aside class="side" :style="{ width: `${sideWidth}px` }">
          <slot name="sidebar" />
        </aside>
        <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />
        <main class="content">
          <slot :ws="current" />
          <EmptyState v-if="!current" v-bind="empty" @action="$emit('empty-action')" />
        </main>
      </div>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import EmptyState from './EmptyState.vue'
import SplitHandle from './SplitHandle.vue'
import ToastHost from './ToastHost.vue'
import { useSplitPane } from '../composables/useSplitPane.js'

const props = defineProps({
  title: { type: String, required: true },
  workspaces: { type: Array, default: () => [] },
  current: { type: Object, default: null },
  running: { type: Number, default: 0 },
  dark: { type: Boolean, default: false },
  snack: { type: Object, required: true },
  // EmptyState 的图标、标题、说明与按钮文字。
  empty: { type: Object, default: () => ({}) },
  toggleTheme: { type: Function, required: true },
})

defineEmits(['empty-action'])

// 左侧工作区列表的宽度随分隔条拖动改变，双击分隔条还原；按工具名下记着，下次打开接着用。
const shellRef = ref(null)
const { size: sideWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: shellRef,
  initial: 268,
  min: 200,
  rightMin: 420,
  persist: `${props.title}.shell.side-width`,
})
</script>

<style scoped>
.app-bar {
  background: rgb(var(--v-theme-surface));
}
.brand {
  font-weight: 600;
  letter-spacing: 0.02em;
}
.running {
  margin-right: 10px;
}
.shell {
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;
}
.side {
  flex: 0 0 auto;
  background: rgb(var(--v-theme-surface));
  overflow-y: auto;
}
.content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
