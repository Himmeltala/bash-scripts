<!--
 * @Author: Himmeltala
 * @Date: 2026-11-23 21:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 18:40:00
 * @FilePath: \idex\web\src\features\engines\components\EngineRegisterState.vue
 * @Description: 引擎页签未登记时的状态块：引擎不可用、正在连接与启用扫描三种，文案由调用方给。
-->
<template>
  <div v-if="error" class="state">
    <v-icon size="28" color="error">mdi-server-off</v-icon>
    <div class="state-text">
      <strong>{{ labels.engine }} 引擎不可用</strong>
      <p>{{ error }}</p>
    </div>
    <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="$emit('retry')">重试</v-btn>
  </div>

  <div v-else-if="loading" class="state">
    <v-progress-circular indeterminate size="20" />
    <div class="state-text">
      <strong>正在连接 {{ labels.engine }} 引擎</strong>
      <p>{{ labels.listHint }}</p>
    </div>
  </div>

  <EmptyState v-else icon="mdi-power-plug-off-outline" :icon-size="44" title="引擎里还没有这个工作区">
    <template #actions>
      <p class="state-hint">
        idex 已经识别出 {{ labels.project }}，但引擎的状态文件里还没有登记。{{ labels.scanHint }}
      </p>
      <p v-if="waiting" class="state-wait">{{ labels.waitHint }}</p>
      <p v-if="enableError" class="state-error">{{ enableError }}</p>
      <v-btn color="primary" variant="flat" :loading="enabling" :disabled="waiting" @click="$emit('enable')">
        {{ waiting ? '扫描中' : '启用并扫描' }}
      </v-btn>
    </template>
  </EmptyState>
</template>

<script setup>
import { EmptyState } from '@bash-scripts/web-shared/layouts'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  waiting: { type: Boolean, default: false },
  enabling: { type: Boolean, default: false },
  enableError: { type: String, default: '' },
  // engine 是引擎名；其余几句按这个页签列出的东西（脚本或模块）拼。
  labels: { type: Object, required: true },
})

defineEmits(['retry', 'enable'])
</script>

<style scoped>
.state {
  flex: 1 1 auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.state-text {
  flex: 1 1 auto;
  min-width: 0;
}
.state-text strong {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.95rem;
}
.state-text p {
  margin: 4px 0 0;
  font-size: 0.82rem;
}
.state-hint {
  margin: 0;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
  max-width: 420px;
}
.state-error {
  color: rgb(var(--v-theme-error));
}
.state-wait {
  color: rgb(var(--v-theme-primary));
}
</style>
