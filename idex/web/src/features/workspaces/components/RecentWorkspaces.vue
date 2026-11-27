<!--
 * @Author: Himmeltala
 * @Date: 2026-11-27 10:06:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-27 10:06:41
 * @FilePath: \idex\web\src\features\workspaces\components\RecentWorkspaces.vue
 * @Description: 顶栏的最近打开菜单：按打开顺序列出工作区，点一条直接切过去，不用回左侧找。
-->
<template>
  <v-menu v-if="items.length" location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        icon
        variant="text"
        class="activator"
        title="最近打开的工作区"
      >
        <v-icon>mdi-history</v-icon>
      </v-btn>
    </template>
    <v-list density="compact" class="menu" max-height="460">
      <v-list-item
        v-for="item in items"
        :key="item.id"
        :active="item.id === current"
        color="primary"
        @click="emit('select', item.id)"
      >
        <v-list-item-title class="name">
          <span class="nm">{{ item.name }}</span>
          <v-chip
            v-if="item.id === current"
            size="x-small"
            variant="tonal"
            color="primary"
            class="here"
          >
            当前
          </v-chip>
        </v-list-item-title>
        <v-list-item-subtitle class="path" :title="item.root">{{ item.root }}</v-list-item-subtitle>
        <template #prepend>
          <v-icon size="18" :title="item.vcsLabel">{{ item.icon }}</v-icon>
        </template>
        <template #append>
          <!-- 只是从最近列表里去掉，工作区仍留在左侧登记表里。 -->
          <v-btn
            icon="mdi-close"
            size="x-small"
            variant="text"
            title="从最近列表移除"
            @click.stop="emit('drop', item.id)"
          />
        </template>
      </v-list-item>
      <template v-if="items.length > 1">
        <v-divider />
        <v-list-item class="clear" @click="emit('clear')">
          <template #prepend>
            <v-icon size="18">mdi-delete-sweep-outline</v-icon>
          </template>
          <v-list-item-title>清空最近记录</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-menu>
</template>

<script setup>
import { computed } from 'vue'
import { baseName } from '../../../utils/format'
import { vcsMeta } from '../lib/recent'

const props = defineProps({
  // 服务端登记的全部工作区；最近列表只存 id，从这里取当前名称与路径。
  workspaces: { type: Array, default: () => [] },
  ids: { type: Array, default: () => [] },
  current: { type: String, default: '' },
})

const emit = defineEmits(['select', 'drop', 'clear'])

const items = computed(() => {
  const byId = new Map(props.workspaces.map((ws) => [ws.id, ws]))
  const out = []
  for (const id of props.ids) {
    const ws = byId.get(id)
    if (!ws) continue
    const meta = vcsMeta(ws.vcs)
    out.push({
      id,
      name: ws.alias || baseName(ws.root),
      root: ws.root || ws.url || '',
      icon: meta.icon,
      vcsLabel: meta.label,
    })
  }
  return out
})
</script>

<style scoped>
.activator {
  margin-left: 4px;
}
.menu {
  min-width: 360px;
  max-width: 560px;
}
.name {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nm {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.here {
  flex: 0 0 auto;
  height: 18px;
}
.path {
  margin-top: 2px;
  font-size: 0.72rem;
  line-height: 1.35;
  opacity: 0.6;
  word-break: break-all;
  white-space: normal;
}
.menu :deep(.v-list-item__content) {
  padding-right: 8px;
}
</style>
