<!--
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 00:59:41
 * @FilePath: \lib\web-shared\src\components\services\ServiceTable.vue
 * @Description: 服务清单表格：模块、命令、状态，以及启动、停止、重启与日志等行操作。
-->

<template>
  <v-table ref="tableEl" density="compact" class="table">
    <thead>
      <tr>
        <th style="width: 42%">{{ nameTitle }}</th>
        <th>参数</th>
        <th style="width: 200px">状态</th>
        <th style="width: 230px"></th>
      </tr>
    </thead>
    <tbody>
      <tr
      v-for="row in rows"
      :key="row.key"
      :data-svc="row.svc ? row.svc.id : ''"
      :class="{ 'focus-row': focusId && row.svc && row.svc.id === focusId }"
    >
        <td>
          <div class="svc-name">
            <span>{{ row.title }}</span>
            <!-- 同一张表里混着启动、构建、安装时靠它区分；不分栏的调用方不用给。 -->
            <v-chip v-if="row.typeText" size="x-small" variant="tonal" class="type-chip">{{ row.typeText }}</v-chip>
          </div>
          <div v-if="showPath && row.path" class="svc-path" :title="row.path">{{ row.path }}</div>
        </td>
        <td>
          <div class="cmd" :title="row.cmd">{{ row.cmd }}</div>
        </td>
        <td>
          <div class="status-line">
            <template v-if="row.live">
              <v-chip size="small" class="status-chip" :color="row.color" variant="tonal" :prepend-icon="row.icon">
                {{ row.statusText }}
              </v-chip>
              <span v-if="row.port" class="meta">端口 {{ row.port }}</span>
              <span v-else-if="row.started" class="meta">{{ row.ago }}</span>
            </template>
            <template v-else-if="row.run">
              <v-chip
                size="small"
                class="status-chip"
                :color="row.color"
                variant="tonal"
                :prepend-icon="row.icon"
                @click="$emit('log', row)"
              >
                {{ row.statusText }}
              </v-chip>
              <span v-if="row.err" class="meta err" :title="row.err">{{ row.err }}</span>
              <span v-else-if="row.started" class="meta">{{ row.ago }}</span>
            </template>
            <span v-else class="meta">—</span>
          </div>
        </td>
        <td class="ops">
          <div class="flex items-center justify-end gap-2 whitespace-nowrap">
          <template v-if="row.live">
            <v-btn size="small" variant="text" prepend-icon="mdi-text-box-outline" @click="$emit('log', row)">
              日志
            </v-btn>
            <v-btn
              v-if="showRestart"
              size="small"
              variant="tonal"
              :loading="row.restarting"
              @click="$emit('restart', row)"
            >
              重启
            </v-btn>
            <v-btn size="small" color="error" variant="tonal" :loading="row.stopping" @click="$emit('stop', row)">
              停止
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              :disabled="row.blocked"
              :loading="row.starting"
              @click="$emit('start', row)"
            >
              {{ row.action }}
            </v-btn>
            <v-btn size="small" variant="text" :icon="true" title="参数" @click="$emit('settings', row)">
              <v-icon size="20">mdi-tune</v-icon>
            </v-btn>
            <v-btn v-if="row.run" size="small" variant="text" prepend-icon="mdi-text-box-outline" @click="$emit('log', row)">
              日志
            </v-btn>
          </template>
          <slot name="row-extra" :row="row" />
          </div>
        </td>
      </tr>
    </tbody>
  </v-table>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  rows: { type: Array, required: true },
  // 第一列的表头，idex 的 Node 引擎叫脚本，mvnx 叫模块，由调用方给。
  nameTitle: { type: String, required: true },
  // 名字下那行路径：idex 的 Node 引擎的服务都跑在工作区根上，只有一个点，调用方可以关掉。
  showPath: { type: Boolean, default: true },
  // 运行中的行要不要给重启按钮；只有实现 restart 接口的工具打开它。
  showRestart: { type: Boolean, default: false },
  // 从顶栏跳过来时高亮并滚到这一行；seq 变化时重新滚动。
  focusId: { type: String, default: '' },
  focusSeq: { type: Number, default: 0 },
})

defineEmits(['start', 'stop', 'restart', 'settings', 'log'])

const tableEl = ref(null)

watch(
  [() => props.focusId, () => props.focusSeq],
  ([id]) => {
    if (!id) return
    nextTick(() => {
      const root = tableEl.value && tableEl.value.$el
      if (!root) return
      const row = Array.from(root.querySelectorAll('tr[data-svc]')).find(
        (item) => item.dataset.svc === id,
      )
      if (row) row.scrollIntoView({ block: 'center' })
    })
  },
)
</script>

<style scoped>
.table {
  flex: 1 1 auto;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}
.focus-row {
  background: rgba(var(--v-theme-primary), 0.12);
  transition: background 0.2s ease;
}
.status-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.status-chip {
  flex: 0 0 auto;
}
.status-line .meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.svc-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.type-chip {
  font-size: 0.7rem;
  height: 18px;
}
.svc-path,
.meta {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.cmd {
  font-family: inherit;
  font-size: 0.76rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 420px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.err {
  color: rgb(var(--v-theme-failed));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.ops {
  text-align: right;
}
</style>
