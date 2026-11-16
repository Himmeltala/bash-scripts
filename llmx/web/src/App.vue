<template>
  <v-app>
    <v-app-bar density="comfortable" flat border>
      <v-app-bar-nav-icon title="收起或展开菜单" @click="drawer = !drawer" />
      <v-app-bar-title>
        <span class="title">llmx</span>
      </v-app-bar-title>
      <template #append>
        <v-btn
          :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          :title="dark ? '切到浅色' : '切到深色'"
          variant="text"
          @click="flipTheme"
        />
      </template>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" :rail="rail" width="200">
      <v-list nav density="compact">
        <v-list-item
          v-for="item in PAGES"
          :key="item.key"
          :prepend-icon="item.icon"
          :title="item.title"
          :active="page.key === item.key"
          @click="go(item.key)"
        />
      </v-list>
      <v-divider class="my-2" />
      <v-list nav density="compact">
        <v-list-item
          :prepend-icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
          :title="rail ? '' : '收起菜单'"
          @click="rail = !rail"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <component :is="current" />
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { PAGES, page, writePageUrl } from './composables/usePage'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { rememberTheme } from './plugins/vuetify'

const VIEWS = {
  usage: defineAsyncComponent(() => import('./views/usage/index.vue')),
  settings: defineAsyncComponent(() => import('./views/settings/index.vue')),
  pricing: defineAsyncComponent(() => import('./views/pricing/index.vue')),
}

const current = computed(() => VIEWS[page.key] || VIEWS.usage)
const drawer = ref(true)
const rail = ref(false)

function go(key) {
  if (page.key === key) return
  page.key = key
  writePageUrl()
}

// 没手动切过深浅色时跟着系统走，系统换主题页面当场跟上。
const { dark, toggle: flipTheme } = useThemeToggle({
  storageKey: 'llmx-theme',
  rememberTheme,
  followSystem: true,
})
</script>

<style scoped>
.title {
  font-weight: 700;
}
</style>
