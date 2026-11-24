<template>
  <div class="tool">
    <div class="bar">
      <SectionNav v-model="section" :items="sections" />
    </div>
    <div class="body">
      <keep-alive>
        <component :is="active" :key="section" v-if="active" />
      </keep-alive>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SectionNav from '../../../../components/SectionNav.vue'

// 一个工具的功能分区都挂在这里；加功能就是加一项。
const SECTIONS = [
  {
    key: 'profiles',
    title: '配置档',
    icon: 'mdi-file-cog-outline',
    component: defineAsyncComponent(() => import('./widgets/SettingsProfiles.vue')),
  },
  {
    key: 'memory',
    title: 'CLAUDE.md',
    icon: 'mdi-note-text-outline',
    component: defineAsyncComponent(() => import('./widgets/ClaudeMemory.vue')),
  },
  {
    key: 'sessions',
    title: '会话',
    icon: 'mdi-forum-outline',
    component: defineAsyncComponent(() => import('./widgets/Sessions.vue')),
  },
  {
    key: 'memories',
    title: '记忆',
    icon: 'mdi-brain',
    component: defineAsyncComponent(() => import('./widgets/ClaudeMemories.vue')),
  },
]
const sections = SECTIONS

const route = useRoute()
const router = useRouter()

const section = computed({
  get: () => SECTIONS.find((item) => item.key === route.query.section)?.key || 'profiles',
  set: (value) => router.replace({ query: { ...route.query, section: value } }),
})
const active = computed(
  () => SECTIONS.find((item) => item.key === section.value)?.component || null,
)
</script>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.bar {
  flex: none;
  padding-bottom: 0.75rem;
}

.body {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
