<!--
 * @Author: Himmeltala
 * @Date: 2026-11-23 21:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 21:00:00
 * @FilePath: \idex\web\src\components\services\JvmSettingsDialog.vue
 * @Description: JVM 服务的参数与运行日志弹窗：模块、启动方式、附加参数与依赖刷新，改完保存到这一行。
-->
<template>
  <FloatingDialog
    v-if="svc"
    :model-value="modelValue"
    :initial-width="760"
    :initial-height="620"
    storage-key="jvm-settings"
    storage="idex.dialog-layouts"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #title>
      <span>{{ actionName }}-{{ svc.tag }}</span>
      <v-chip size="small" class="ml-3" variant="tonal">{{ actionName }}</v-chip>
      <v-chip size="small" class="ml-2" variant="outlined">{{ kindText }}</v-chip>
      <v-chip v-if="logStatus" size="small" class="ml-2" variant="outlined">{{ logStatus }}</v-chip>
      <v-spacer />
      <v-btn :icon="true" variant="text" @click="$emit('update:modelValue', false)">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>

    <div class="grid">
      <v-text-field
        v-if="!isGradle"
        :model-value="moduleText"
        label="模块（由目标决定）"
        density="compact"
        variant="outlined"
        readonly
        hint="模块由目标扫描给出，这里只做展示"
        persistent-hint
      />
      <v-select
        v-model="mode"
        :items="modeItems"
        item-title="title"
        item-value="value"
        :label="isGradle ? '执行方式' : '启动方式'"
        density="compact"
        variant="outlined"
        :hint="modeHint"
        persistent-hint
      />
      <v-checkbox
        v-if="isGradle"
        v-model="refresh"
        label="刷新依赖（--refresh-dependencies）"
        density="compact"
        hide-details
      />
    </div>

    <v-textarea
      v-model="args"
      label="本行附加参数"
      :placeholder="isGradle ? '--info' : '-Dserver.port=8081'"
      rows="2"
      auto-grow
      density="compact"
      variant="outlined"
      class="mt-4"
      hint="保存到这个动作上，下次启动直接用；追加到工具命令尾部"
      persistent-hint
    />

    <div class="preview">
      <span class="label">将要执行</span>
      <code>{{ preview }}</code>
    </div>

    <RunLogPanel
      :text="logText"
      :more="logMore"
      :dark="dark"
      @load-more="$emit('load-more')"
    />

    <template #actions>
      <span class="hint">{{ actionName }}的参数只存到这个动作上，不影响同一模块的其他动作</span>
      <v-spacer />
      <v-btn variant="text" @click="$emit('update:modelValue', false)">关闭</v-btn>
      <v-btn color="primary" variant="flat" @click="save">保存</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { RunLogPanel } from '@bash-scripts/web-shared'
import { GRADLE_MODE_ITEMS, MODE_ITEMS, TYPE_TEXT } from '../../utils/jvmFormat'
import { jvmKindLabel } from '../../utils/workspaceTabs'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  svc: { type: Object, default: null },
  kind: { type: String, default: 'mvn' },
  logText: { type: String, default: '' },
  logMore: { type: Boolean, default: false },
  logStatus: { type: String, default: '' },
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save', 'load-more'])

const module = ref('')
const args = ref('')
const mode = ref('auto')
const refresh = ref(false)

const isGradle = computed(() => props.kind === 'gradle')
const actionName = computed(() => TYPE_TEXT[props.svc && props.svc.type] || '')
const kindText = computed(() => jvmKindLabel(props.kind) || props.kind)
const moduleText = computed(() => module.value || '工作区根')

const modeItems = computed(() => (isGradle.value ? GRADLE_MODE_ITEMS : MODE_ITEMS))
const modeHint = computed(() => {
  const hit = modeItems.value.find((item) => item.value === mode.value)
  return hit ? hit.hint : ''
})

// 打开时按这一行存着的参数填；清空后保存就是删掉附加参数。
watch(
  () => props.svc,
  (svc) => {
    module.value = svc ? svc.module || '' : ''
    args.value = svc ? svc.args || '' : ''
    mode.value = svc && svc.mode ? svc.mode : 'auto'
    refresh.value = !!(svc && svc.refresh)
  },
  { immediate: true },
)

const preview = computed(() => {
  // base_cmd 是不带附加参数的那条命令，页面只重拼用户这一部分。
  const base =
    (props.svc && (props.svc.base_cmd || props.svc.cmd)) || (isGradle.value ? 'gradle' : 'mvn')
  if (!args.value.trim()) return base
  return `${base} ${args.value.trim()}`
})

function save() {
  emit('save', {
    module: module.value || '',
    args: (args.value || '').trim(),
    mode: mode.value,
    refresh: refresh.value,
  })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}
.label {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
code {
  font-size: 0.82rem;
  word-break: break-all;
  background: rgb(var(--v-theme-surface-variant));
  padding: 6px 8px;
  border-radius: 6px;
}
.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
