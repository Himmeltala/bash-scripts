<template>
  <FloatingDialog
    :model-value="modelValue"
    storage-key="netx-flow"
    :initial-width="900"
    :initial-height="700"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #title>
      <span>连接详情</span>
      <span v-if="flow" class="title-sub">#{{ flow.id }} · {{ flow.comm || '-' }}</span>
    </template>

    <div v-if="loading" class="state">
      <v-progress-linear indeterminate color="primary" />
      <span>正在读取…</span>
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal" density="compact" class="notice">
      {{ error }}
      <template #append>
        <v-btn size="small" variant="text" @click="load">重试</v-btn>
      </template>
    </v-alert>

    <template v-else-if="data">
      <div class="chips">
        <v-chip size="small" variant="tonal">{{ kindLabel(data.kind) }}</v-chip>
        <v-chip v-if="data.truncated" size="small" variant="tonal" color="warning">已截断</v-chip>
        <v-chip v-if="flow" size="small" variant="text">{{ dest }}</v-chip>
      </div>

      <v-tabs v-model="tab" density="compact" class="tabs">
        <v-tab value="overview">概览</v-tab>
        <v-tab value="headers">请求头</v-tab>
        <v-tab value="body">正文</v-tab>
        <v-tab value="raw">原文</v-tab>
      </v-tabs>

      <div v-if="tab === 'overview'" class="overview">
        <div class="row"><span>开始</span><b>{{ formatTime(flow && flow.started) }}</b></div>
        <div class="row"><span>进程</span><b>{{ (flow && flow.comm) || '-' }} ({{ flow && flow.pid }})</b></div>
        <div class="row"><span>可执行文件</span><b class="mono">{{ (flow && flow.exe) || '-' }}</b></div>
        <div class="row"><span>目标</span><b class="mono">{{ dest }}</b></div>
        <div class="row"><span>发送</span><b>{{ sent }}</b></div>
        <div v-if="parsed.method" class="row"><span>方法</span><b>{{ parsed.method }}</b></div>
        <div v-if="parsed.host" class="row"><span>Host</span><b class="mono">{{ parsed.host }}</b></div>
        <div v-if="parsed.url" class="row"><span>URL</span><b class="mono">{{ parsed.url }}</b></div>
        <div v-if="parsed.sni && data.kind !== 'http'" class="row">
          <span>SNI</span><b class="mono">{{ parsed.sni }}</b>
        </div>
        <div v-if="parsed.dns_name" class="row">
          <span>DNS</span><b class="mono">{{ parsed.dns_name }} {{ parsed.dns_type }}</b>
        </div>
        <div v-if="alpn.length" class="row"><span>ALPN</span><b>{{ alpn.join('、') }}</b></div>
        <p v-if="data.kind === 'tls'" class="hint">
          TLS 正文是加密的，只能看到握手阶段的域名信息。
        </p>
      </div>

      <div v-else-if="tab === 'headers'">
        <v-table v-if="headers.length" density="compact" class="headers">
          <thead>
            <tr><th>名称</th><th>值</th></tr>
          </thead>
          <tbody>
            <tr v-for="(header, index) in headers" :key="index">
              <td class="mono">{{ header[0] }}</td>
              <td class="mono value">{{ header[1] }}</td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="hint">这条连接没有可解析的请求头。</p>
      </div>

      <div v-else-if="tab === 'body'">
        <template v-if="bodyText">
          <p v-if="bodyEncoding === 'hex'" class="hint">正文不是文本，按十六进制显示开头。</p>
          <pre class="block">{{ bodyText }}</pre>
        </template>
        <p v-else class="hint">这条连接没有解析出的正文。</p>
      </div>

      <div v-else-if="tab === 'raw'" class="raw">
        <p class="hint">只保留连接开头的内容，超出的部分在列表里只看发送量。</p>
        <pre class="block hex">{{ data.raw_hex }}</pre>
      </div>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { flowDetail } from '../composables/useApi'
import { formatTime, kindLabel } from '../utils/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  flowId: { type: [Number, String], default: null },
})

defineEmits(['update:modelValue'])

const data = ref(null)
const loading = ref(false)
const error = ref('')
const tab = ref('overview')

const flow = computed(() => (data.value && data.value.flow) || null)
const parsed = computed(() => (data.value && data.value.parsed) || {})
const headers = computed(() => parsed.value.headers || [])
const alpn = computed(() => parsed.value.alpn || [])
const dest = computed(() =>
  flow.value ? flow.value.dst_ip + ':' + flow.value.dst_port : '—',
)
const sent = computed(() =>
  flow.value
    ? formatBytes(flow.value.bytes_out, { units: ['B', 'KB', 'MB', 'GB'], precision: [0, 1, 2, 2] })
    : '—',
)
const bodyText = computed(() => parsed.value.body || parsed.value.preview || '')
const bodyEncoding = computed(() => parsed.value.body_encoding || parsed.value.preview_encoding || '')

async function load() {
  if (!props.flowId) return
  loading.value = true
  error.value = ''
  try {
    data.value = await flowDetail(props.flowId)
  } catch (err) {
    data.value = null
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(
  [() => props.modelValue, () => props.flowId],
  ([open]) => {
    if (!open) return
    tab.value = 'overview'
    load()
  },
  { immediate: true },
)
</script>

<style scoped>
.title-sub {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.85rem;
  margin-left: 10px;
}
.state {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.notice {
  margin-bottom: 12px;
}
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.tabs {
  margin-bottom: 14px;
}
.overview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  font-size: 0.9rem;
}
.row > span {
  color: rgb(var(--v-theme-on-surface-variant));
}
.row b {
  font-weight: 500;
  overflow-wrap: anywhere;
}
.mono {
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 0.86em;
}
.headers .value {
  white-space: normal;
  overflow-wrap: anywhere;
}
.block {
  margin: 0;
  padding: 12px;
  max-height: 420px;
  overflow: auto;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-variant));
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 0.82rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.hex {
  word-break: break-all;
  white-space: pre-wrap;
}
.hint {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
  margin: 10px 0 0;
}
</style>
