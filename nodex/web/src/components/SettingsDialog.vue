<template>
  <FloatingDialog
    v-if="svc"
    :model-value="modelValue"
    :initial-width="760"
    :initial-height="620"
    storage-key="settings"
    storage="nodex.dialog-layouts"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #title>
      <span>{{ actionName }}-{{ svc.tag }}</span>
      <v-chip size="small" class="ml-3" variant="tonal">{{ actionName }}</v-chip>
      <v-chip v-if="logStatus" size="small" class="ml-2" variant="outlined">{{ logStatus }}</v-chip>
      <v-spacer />
      <v-btn :icon="true" variant="text" @click="$emit('update:modelValue', false)">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>

    <div class="where">
      <span class="label">脚本</span>
      <code>{{ svc.display || '.' }}</code>
      <span class="path" :title="svc.path">{{ svc.path }}</span>
    </div>

    <v-textarea
      v-model="args"
      label="执行命令"
      :placeholder="placeholder"
      rows="2"
      auto-grow
      density="compact"
      variant="outlined"
      class="mt-4"
      hint="整条命令按这里执行，第一个词写包管理器或程序；改完保存，下次就按这个跑"
      persistent-hint
    />

    <div class="preview">
      <span class="label">将要执行</span>
      <code>{{ preview }}</code>
    </div>

    <ServiceLogPane
      :text="logText"
      :more="logMore"
      :dark="dark"
      :colorize="colorize"
      @load-more="$emit('load-more', logRun)"
    />

    <template #actions>
      <span class="hint">{{ actionName }}的参数只存到这个动作上，不影响同一个脚本的其他动作</span>
      <v-spacer />
      <v-btn variant="text" @click="$emit('update:modelValue', false)">关闭</v-btn>
      <v-btn color="primary" variant="flat" @click="save">保存</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { TYPE_TEXT } from '../composables/format'
import { colorize } from '../composables/logColor'
import { FloatingDialog, ServiceLogPane } from '@bash-scripts/web-shared'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  svc: { type: Object, default: null },
  logText: { type: String, default: '' },
  logMore: { type: Boolean, default: false },
  logStatus: { type: String, default: '' },
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save', 'load-more'])

const args = ref('')
const actionName = computed(() => TYPE_TEXT[props.svc && props.svc.type] || '')

// 打开时按这个动作存着的参数填，改的就是它。
watch(
  () => props.svc,
  (svc) => {
    args.value = svc ? svc.args || '' : ''
  },
  { immediate: true },
)

const preview = computed(() => {
  if (!props.svc) return ''
  const dir = props.svc.path || props.svc.display || '.'
  const body = args.value.trim()
  return body ? `cd ${dir} && ${body}` : ''
})

const placeholder = computed(() => {
  const type = props.svc && props.svc.type
  if (type === 'install') return 'npm install'
  if (type === 'build') return 'npm run build'
  return 'npm run dev'
})

const logRun = computed(() => (props.svc && props.svc.run ? props.svc.run.id : ''))

function save() {
  emit('save', { args: args.value.trim() })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.where {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.where .path {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
  word-break: break-all;
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
