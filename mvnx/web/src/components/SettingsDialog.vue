<template>
  <FloatingDialog
    v-if="svc"
    :model-value="modelValue"
    :initial-width="760"
    :initial-height="620"
    storage-key="settings"
    storage="mvnx.dialog-layouts"
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

    <div class="grid">
      <v-combobox
        v-model="module"
        :items="moduleItems"
        label="指定模块（mvn -pl）"
        density="compact"
        variant="outlined"
        clearable
        hint="留空按服务自己的位置跑；选了就只在这个模块上执行"
        persistent-hint
      />
      <v-select
        v-if="isService"
        v-model="mode"
        :items="modeItems"
        item-title="title"
        item-value="value"
        label="启动方式"
        density="compact"
        variant="outlined"
        :hint="modeHint"
        persistent-hint
      />
    </div>

    <v-textarea
      v-model="args"
      label="本次附加参数"
      placeholder="-Dserver.port=8081"
      rows="2"
      auto-grow
      density="compact"
      variant="outlined"
      class="mt-4"
      hint="只对这一次生效，参数会一并存进这个服务，下次直接用"
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
      <span class="hint">{{ actionName }}的参数只存到这个动作上，不影响同一模块的其他动作</span>
      <v-spacer />
      <v-btn variant="text" @click="$emit('update:modelValue', false)">关闭</v-btn>
      <v-btn color="primary" variant="flat" @click="save">保存</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MODE_ITEMS, TYPE_TEXT, moduleOf } from '../composables/format'
import { colorize } from '../composables/logColor'
import { FloatingDialog, ServiceLogPane } from '@bash-scripts/web-shared'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  svc: { type: Object, default: null },
  poms: { type: Array, default: () => [] },
  logText: { type: String, default: '' },
  logMore: { type: Boolean, default: false },
  logStatus: { type: String, default: '' },
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save', 'load-more'])

const module = ref('')
const args = ref('')
const mode = ref('auto')

const isService = computed(() => props.svc && (props.svc.type === 'run' || props.svc.type === 'war'))
const actionName = computed(() => TYPE_TEXT[props.svc && props.svc.type] || '')

const moduleItems = computed(() => props.poms.map((rel) => ({ title: moduleOf(rel), value: moduleOf(rel) })))

const modeItems = MODE_ITEMS
const modeHint = computed(() => {
  const hit = MODE_ITEMS.find((m) => m.value === mode.value)
  return hit ? hit.hint : ''
})

// 打开时按服务上存着的参数填；服务自带的参数之外，用户加的留空，避免误删原来的。
const savedArgs = ref('')
watch(
  () => props.svc,
  (svc) => {
    module.value = svc ? svc.module || '' : ''
    savedArgs.value = svc ? svc.args || '' : ''
    args.value = ''
    mode.value = 'auto'
  },
  { immediate: true },
)

const preview = computed(() => {
  const parts = ['mvn']
  if (module.value) parts.push('-pl', module.value)
  parts.push(savedArgs.value || (props.svc && props.svc.args) || '')
  if (args.value.trim()) parts.push(args.value.trim())
  return parts.filter(Boolean).join(' ')
})

const logRun = computed(() => (props.svc && props.svc.run ? props.svc.run.id : ''))

function save() {
  emit('save', { module: module.value || '', args: (savedArgs.value || '').trim() })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
}
code {
  background: rgb(var(--v-theme-surface-variant));
  padding: 6px 8px;
  border-radius: 6px;
}
.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
