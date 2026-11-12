<template>
  <v-dialog :model-value="modelValue" max-width="760" scrollable @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="svc">
      <v-card-title class="d-flex align-center">
        <span>{{ actionName }}-{{ svc.tag }}</span>
        <v-chip size="small" class="ml-3" variant="tonal">{{ actionName }}</v-chip>
        <v-chip v-if="logStatus" size="small" class="ml-2" variant="outlined">{{ logStatus }}</v-chip>
        <v-spacer />
        <v-btn :icon="true" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div class="where">
          <span class="label">包</span>
          <code>{{ svc.display || '.' }}</code>
          <span class="path" :title="svc.path">{{ svc.path }}</span>
        </div>

        <v-textarea
          v-model="args"
          label="执行参数"
          placeholder="run dev"
          rows="2"
          auto-grow
          density="compact"
          variant="outlined"
          class="mt-4"
          hint="第一个词是子命令，后面是它自己的参数；改完保存，下次启动就按这个跑"
          persistent-hint
        />

        <div class="preview">
          <span class="label">将要执行</span>
          <code>{{ preview }}</code>
        </div>

        <div class="log-head">
          <span class="label">日志</span>
          <v-spacer />
          <v-btn v-if="logMore" size="small" variant="text" prepend-icon="mdi-history" @click="$emit('load-more', logRun)">更早</v-btn>
        </div>
        <LogView v-if="logText" :text="logText" :dark="dark" />
        <p v-else class="log-empty">还没有运行过</p>
      </v-card-text>

      <v-card-actions>
        <span class="hint">{{ actionName }}的参数只存到这个动作上，不影响同一个包的其他动作</span>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">关闭</v-btn>
        <v-btn color="primary" variant="flat" @click="save">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { TYPE_TEXT } from '../composables/format'
import LogView from './LogView.vue'

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
  const pm = props.svc.pm || ''
  const body = [pm, args.value.trim()].filter(Boolean).join(' ')
  return `cd ${dir} && ${body}`
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
  font-family: inherit;
  font-size: 0.82rem;
  word-break: break-all;
  background: rgb(var(--v-theme-surface-variant));
  padding: 6px 8px;
  border-radius: 6px;
}
.log-head {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.log-empty {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.86rem;
}
.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
