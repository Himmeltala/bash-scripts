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
      <p v-else class="hint">这个页签还没接入。</p>
    </div>
  </v-container>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandIcon from '../../components/BrandIcon.vue'

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

const route = useRoute()
const router = useRouter()

const tab = computed({
  get: () => TABS.find((item) => item.key === route.query.tab && item.enabled)?.key || 'claude',
  // 换工具页签就把分区参数清掉，回到新工具自己的默认分区。
  set: (value) =>
    router.replace({ query: { ...route.query, tab: value, section: undefined } }),
})
const active = computed(
  () => TABS.find((item) => item.key === tab.value && item.enabled)?.component || null,
)
</script>

<style scoped>
.hint {
  margin: 16px 0;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

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
