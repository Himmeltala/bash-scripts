<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="920"
    :initial-height="660"
    :min-width="560"
    :min-height="400"
    storage-key="profile-apply"
    storage="llmx.dialog-layouts"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>应用配置档 {{ name }}</template>

    <p class="hint">
      将整份覆盖 <span class="mono">{{ target }}</span>；现有文件会先备份到备份目录。
    </p>
    <DiffView
      :text="text"
      kind="diff"
      :path="`${name}.json`"
      :title="`${name}.json`"
      :loading="loading"
      :error="loadError"
    />
    <p v-if="!loading && !loadError && same" class="text-body-2 text-medium-emphasis">
      这份内容与当前生效文件相同，不用再应用。
    </p>

    <template #actions>
      <v-btn variant="text" @click="close">取消</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="busy"
        :disabled="loading || same || !!loadError"
        @click="submit"
      >
        应用到 settings.json
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { toast } from '../../../../composables/notice'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { DiffView } from '@bash-scripts/web-shared/diff'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  name: { type: String, default: '' },
  load: { type: Function, required: true },
  submit: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const text = ref('')
const target = ref('')
const same = ref(false)
const loading = ref(false)
const loadError = ref('')
const error = ref('')
watch(error, (text) => text && toast(text, 'error'))
const busy = ref(false)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    text.value = ''
    target.value = ''
    same.value = false
    loadError.value = ''
    error.value = ''
    busy.value = false
    loading.value = true
    try {
      const data = await props.load(props.name)
      text.value = data.text
      target.value = data.target
      same.value = !!data.applied
    } catch (err) {
      loadError.value = err.message
    } finally {
      loading.value = false
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await props.submit()
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.mono {
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 0.8rem;
}
</style>
