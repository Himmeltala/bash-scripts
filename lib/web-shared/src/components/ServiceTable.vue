<template>
  <v-table density="compact" class="table">
    <thead>
      <tr>
        <th style="width: 42%">{{ nameTitle }}</th>
        <th>参数</th>
        <th style="width: 200px">状态</th>
        <th style="width: 230px"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key">
        <td>
          <div class="svc-name">{{ row.title }}</div>
          <div class="svc-path" :title="row.path">{{ row.path }}</div>
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
          <template v-if="row.live">
            <v-btn size="small" variant="text" prepend-icon="mdi-text-box-outline" @click="$emit('log', row)">
              日志
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
        </td>
      </tr>
    </tbody>
  </v-table>
</template>

<script setup>
defineProps({
  rows: { type: Array, required: true },
  // 第一列的表头，nodex 叫脚本，mvnx 叫模块，由调用方给。
  nameTitle: { type: String, required: true },
})

defineEmits(['start', 'stop', 'settings', 'log'])
</script>

<style scoped>
.table {
  flex: 1 1 auto;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
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
  font-weight: 500;
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
  white-space: nowrap;
}
</style>
