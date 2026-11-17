<template>
  <v-app>
    <v-app-bar density="comfortable" flat border="b" class="app-bar">
      <v-app-bar-nav-icon
        :title="sideOpen ? '收起左侧列表' : '展开左侧列表'"
        @click="sideOpen = !sideOpen"
      />
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
        <div
          class="side-slot"
          :style="{ width: sideOpen ? `${sideWidth}px` : '0px' }"
        />
        <div class="side-layer" :class="{ folded: !sideOpen }" :style="{ width: `${sideWidth}px` }">
          <aside class="side">
            <slot name="sidebar" />
          </aside>
        </div>
        <SplitHandle
          v-show="sideOpen"
          axis="x"
          :active="resizing"
          @start="startSplit"
          @reset="resetSplit"
        />
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
import EmptyState from '../../layouts/commons/EmptyState.vue'
import SplitHandle from '../../layouts/commons/SplitHandle.vue'
import ToastHost from '../../feedbacks/commons/ToastHost.vue'
import { useSplitPane } from '../../composables/commons/useSplitPane.js'

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
// 左侧列表是否展开；用头部的按钮收起，收起后正文占满。
const sideOpen = ref(true)
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
  position: relative;
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;
}
/* 占位层跟着开关一次性改变宽度；侧栏本体绝对定位，靠 transform 滑出，不再逐帧重排正文。 */
.side-slot {
  flex: 0 0 auto;
}
.side-layer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 2;
  transition: transform 0.18s ease, opacity 0.14s ease;
}
.side-layer.folded {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}
.side {
  width: 100%;
  height: 100%;
  min-width: 0;
  background: rgb(var(--v-theme-surface));
  overflow: hidden auto;
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
