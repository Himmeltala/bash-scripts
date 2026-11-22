<template>
  <v-app>
    <v-app-bar density="comfortable" flat border>
      <v-app-bar-nav-icon title="收起或展开菜单" @click="drawer = !drawer" />
      <v-app-bar-title>
        <span class="title">llmx</span>
      </v-app-bar-title>
      <template #append>
        <AlertBell />
        <Metrics :dark="dark" :metrics="metrics" />
        <v-btn
          :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          :title="dark ? '切到浅色' : '切到深色'"
          variant="text"
          @click="flipTheme"
        />
      </template>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" :width="navWidth" class="nav-drawer">
      <div class="nav">
        <div class="nav-body">
          <v-list nav density="compact">
            <v-list-item
              v-for="item in PAGES"
              :key="item.key"
              :to="item.path"
              :prepend-icon="item.icon"
              :title="item.title"
            />
          </v-list>
        </div>
        <SplitHandle
          axis="x"
          :active="resizing"
          @start="startSplit"
          @reset="resetSplit"
        />
      </div>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>

    <ToastHost v-model="snack.on" :text="snack.text" :color="snack.color" />
  </v-app>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { PAGES } from './router'
import AlertBell from './components/AlertBell.vue'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { Metrics } from '@bash-scripts/web-shared/metrics'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { useSplitPane } from '@bash-scripts/web-shared'
import { ToastHost } from '@bash-scripts/web-shared/feedbacks'
import { snack } from './composables/notice'
import { rememberTheme } from './plugins/vuetify'

const drawer = ref(true)

// 左侧菜单的宽度随分隔条拖动改变，双击还原；上限按整个窗口算，右侧至少留出正文的宽度。
const viewport = shallowRef(document.documentElement)
const { size: navWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: viewport,
  initial: 200,
  min: 160,
  rightMin: 420,
  persist: 'llmx.nav-width',
})

// 头部性能指标：CPU、内存、磁盘与网速，单独一条推送。
const metrics = ref(null)
let metricsSource = null

function connectMetrics() {
  metricsSource = new EventSource('/api/metrics/stream')
  metricsSource.addEventListener('metrics', (ev) => {
    try {
      metrics.value = JSON.parse(ev.data)
    } catch (err) {
      // 单条坏了跳过，下一份再补。
    }
  })
}

onMounted(connectMetrics)
onBeforeUnmount(() => {
  if (metricsSource) metricsSource.close()
})

// 没手动切过深浅色时跟着系统走，系统换主题页面当场跟上。
const { dark, toggle: flipTheme } = useThemeToggle({
  storageKey: 'llmx-theme',
  rememberTheme,
  followSystem: true,
})
</script>

<style scoped>
/* 收起展开的节奏跟 nodex 一致：侧栏滑出 0.18s、淡出 0.14s，正文宽度直接让位不跟着动。 */
.nav-drawer {
  transition: transform 0.18s ease, opacity 0.14s ease;
}

.nav-drawer:not(.v-navigation-drawer--active) {
  opacity: 0;
}

.v-main {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .nav-drawer,
  .v-main {
    transition: none;
  }
}

.title {
  font-weight: 700;
}
/* 菜单内容自己滚，右沿留一条拖拽手柄。 */
.nav {
  display: flex;
  height: 100%;
}
.nav-body {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
}
</style>
