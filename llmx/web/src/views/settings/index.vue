<template>
  <v-container fluid class="pa-2 page">
    <div class="tabs">
      <v-tabs v-model="tab" density="compact" show-arrows>
        <v-tab
          v-for="item in tabs"
          :key="item.key"
          :value="item.key"
          :disabled="!item.enabled"
        >
          <BrandIcon :name="item.brand" :size="18" class="mr-2" />
          {{ item.title }}
          <v-chip v-if="!item.enabled" size="x-small" variant="tonal" class="ml-2">未接入</v-chip>
        </v-tab>
      </v-tabs>
      <v-divider />
    </div>

    <div class="body">
      <component :is="active" v-if="active" />
      <v-alert v-else type="info" variant="tonal" density="compact">
        这个页签还没接入。
      </v-alert>
    </div>
  </v-container>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import BrandIcon from '../../components/BrandIcon.vue'
import { page, writePageUrl } from '../../composables/usePage'

// 加一个工具就是加一项；未接入的先留禁用占位。
const TABS = [
  {
    key: 'claude',
    title: 'Claude Code',
    brand: 'claude',
    enabled: true,
    component: defineAsyncComponent(() => import('./components/ClaudeCodeConfig/index.vue')),
  },
  { key: 'dsh', title: 'DeepSeek Harness', brand: 'dsh', enabled: false },
  { key: 'opencode', title: 'opencode', brand: 'opencode', enabled: false },
]
const tabs = TABS

function initialTab() {
  const value = new URLSearchParams(location.search).get('tab')
  return TABS.find((item) => item.key === value && item.enabled)?.key || 'claude'
}

const tab = ref(initialTab())
const active = computed(
  () => TABS.find((item) => item.key === tab.value && item.enabled)?.component || null,
)

watch(tab, (value) => {
  if (page.key !== 'settings') return
  // 换工具页签就把分区参数清掉，回到新工具自己的默认分区。
  writePageUrl({ tab: value, section: null })
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top));
  overflow: hidden;
}

.tabs {
  flex: none;
}

.body {
  flex: 1 1 auto;
  min-height: 0;
  padding-top: 0.75rem;
}
</style>
