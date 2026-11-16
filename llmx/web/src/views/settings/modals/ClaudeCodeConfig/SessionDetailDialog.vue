<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="840"
    :initial-height="640"
    :min-width="520"
    :min-height="380"
    storage-key="session-detail"
    storage="llmx.dialog-layouts"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>会话 {{ id }}</template>

    <p v-if="loading" class="hint">正在读取…</p>
    <template v-else-if="error" />
    <template v-else-if="info">
      <div class="facts">
        <span>项目：{{ info.project || '-' }}</span>
        <span>开始：{{ info.started || '-' }}</span>
        <span>最后活动：{{ info.ended || '-' }}</span>
        <span>请求：{{ info.requests }}</span>
        <span>token：{{ formatCompact(info.total_tokens) }}</span>
        <span>费用：{{ info.cost == null ? '-' : formatMoney(info.cost) }}</span>
        <span>文件：{{ info.files.length }} 个，{{ formatBytes(info.size) }}</span>
      </div>
      <v-chip-group v-if="info.models.length" column>
        <v-chip v-for="model in info.models" :key="model" size="small" variant="tonal">
          {{ model }}
        </v-chip>
      </v-chip-group>
      <p v-if="info.unpriced_models.length" class="text-body-2 text-medium-emphasis my-2">
        这些模型没有价格，只算 token 不算钱：{{ info.unpriced_models.join('、') }}
      </p>

      <v-table density="compact" class="rows">
        <thead>
          <tr>
            <th>模型</th>
            <th>API 地址</th>
            <th class="num">请求</th>
            <th class="num">token</th>
            <th class="num">费用</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in info.rows" :key="`${row.model}/${row.api}`">
            <td>{{ row.model }}</td>
            <td class="mono">{{ row.api || '-' }}</td>
            <td class="num">{{ row.requests }}</td>
            <td class="num">{{ formatCompact(row.total_tokens) }}</td>
            <td class="num">{{ formatMoney(row.cost) }}</td>
          </tr>
        </tbody>
      </v-table>
      <p v-if="!info.rows.length" class="hint">账本里没有这个会话的记录，可能还没导入。</p>
      <p class="hint files">
        <span v-for="file in info.files" :key="file" class="mono">{{ file }}</span>
      </p>
    </template>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="emit('update:modelValue', false)">关闭</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { toast } from '../../../../composables/notice'
import { FloatingDialog } from '@bash-scripts/web-shared'
import { formatBytes, formatCompact, formatMoney } from '@bash-scripts/web-shared/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  id: { type: String, default: '' },
  load: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const info = ref(null)
const loading = ref(false)
const error = ref('')
watch(error, (text) => text && toast(text, 'error'))

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    info.value = null
    error.value = ''
    loading.value = true
    try {
      info.value = await props.load(props.id)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  },
)
</script>

<style scoped>
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.25rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.rows {
  margin-top: 0.5rem;
}

.num {
  text-align: right;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  word-break: break-all;
}

.files {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: 0.5rem;
}

.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
