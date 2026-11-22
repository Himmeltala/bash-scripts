<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatBytes, formatDateTime, formatNumber, formatTimestamp } from '@bash-scripts/web-shared/format'
import { get, post } from '../../composables/useApi'
import { toast } from '../../composables/notice'

const status = ref(null)
const loading = ref(false)
const busy = ref('')

const gcOn = ref(false)
const keepDays = ref(180)

async function load() {
  loading.value = true
  try {
    status.value = await get('/store')
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    loading.value = false
  }
}

async function act(action, extra = {}) {
  busy.value = action
  try {
    const body = await post('/store', { action, ...extra })
    toast(
      action === 'gc'
        ? `清理完成：删除 ${body.removed} 行，${body.sessions} 个会话过期`
        : `导入完成：现扫 ${body.records} 条，新增 ${body.added} 行`,
      'primary'
    )
    await load()
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    busy.value = ''
    gcOn.value = false
  }
}

onMounted(load)

const warnings = computed(() => {
  const out = []
  if (!status.value) return out
  if (!status.value.enabled) out.push('配置里 store.enabled 为 false，账本没有启用。')
  if (status.value.unpriced_models?.length) {
    out.push(`有 ${status.value.unpriced_models.length} 个模型没配价格：${status.value.unpriced_models.join('、')}`)
  }
  const stale = (status.value.sources || []).filter((item) => {
    if (!item.seen_at) return true
    return Date.now() / 1000 - Number(item.seen_at) > 7 * 86400
  })
  if (stale.length) out.push(`超过 7 天没采集到新记录的来源：${stale.map((item) => item.source).join('、')}`)
  if (!status.value.requests) out.push('账本还是空的，先导入一次。')
  return out
})
</script>

<template>
  <v-container fluid class="pa-2 page">
    <div class="head">
      <span class="title">账本</span>
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="load">刷新</v-btn>
      <v-btn
        variant="text"
        prepend-icon="mdi-database-import-outline"
        :loading="busy === 'import'"
        @click="act('import')"
      >
        导入
      </v-btn>
      <v-btn
        variant="text"
        prepend-icon="mdi-broom"
        :disabled="!status?.enabled"
        @click="gcOn = true"
      >
        清理
      </v-btn>
    </div>

    <template v-if="status">
      <v-card variant="flat" class="block">
        <v-card-text class="grid">
          <div class="wide"><span class="label">位置</span><span class="value mono">{{ status.path }}</span></div>
          <div><span class="label">大小</span><span class="value">{{ formatBytes(status.size || 0) }}</span></div>
          <div><span class="label">请求</span><span class="value">{{ formatNumber(status.requests) }}</span></div>
          <div><span class="label">会话</span><span class="value">{{ formatNumber(status.sessions) }}</span></div>
          <div>
            <span class="label">最近采集</span>
            <span class="value">{{ formatTimestamp(status.seen_at, { fallback: '还没有采集记录' }) }}</span>
          </div>
          <div class="wide">
            <span class="label">数据范围</span>
            <span class="value">
              {{ formatDateTime(status.first_at, true) || '-' }} 至
              {{ formatDateTime(status.last_at, true) || '-' }}
            </span>
          </div>
        </v-card-text>
      </v-card>

      <v-card v-if="warnings.length" variant="flat" class="block warn">
        <v-card-title>数据健康</v-card-title>
        <v-card-text>
          <p v-for="item in warnings" :key="item" class="hint bad">{{ item }}</p>
        </v-card-text>
      </v-card>

      <v-card variant="flat" class="block">
        <v-card-title>各来源</v-card-title>
        <v-table density="compact">
          <thead>
            <tr>
              <th>来源</th>
              <th class="num">请求</th>
              <th class="num">会话</th>
              <th>最近采集</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in status.sources || []" :key="item.source">
              <td>{{ item.source }}</td>
              <td class="num">{{ formatNumber(item.requests) }}</td>
              <td class="num">{{ formatNumber(item.sessions) }}</td>
              <td>{{ formatTimestamp(item.seen_at, { fallback: '还没有采集记录' }) }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>

    <v-dialog v-model="gcOn" max-width="420">
      <v-card>
        <v-card-title>清理账本</v-card-title>
        <v-card-text>
          <p class="hint">删除超过指定天数没再出现的会话记录，文件本身不会被重扫。</p>
          <v-text-field
            v-model.number="keepDays"
            type="number"
            min="1"
            label="保留最近多少天"
            density="compact"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="gcOn = false">取消</v-btn>
          <v-btn color="error" variant="flat" :loading="busy === 'gc'" @click="act('gc', { keep_days: keepDays })">
            清理
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.page {
  height: calc(100vh - var(--v-layout-top));
  overflow: auto;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.title {
  font-size: 1rem;
  font-weight: 600;
  margin-right: 8px;
}
.block {
  margin-bottom: 10px;
}
.block :deep(.v-card-title) {
  font-size: 0.95rem;
  padding-bottom: 4px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px 24px;
}
.grid > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.grid > .wide {
  grid-column: 1 / -1;
}
.label {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.74rem;
}
.value {
  font-size: 0.84rem;
  line-height: 1.45;
  word-break: break-word;
}
.mono {
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  word-break: break-all;
}
.hint {
  margin: 0 0 6px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.hint.good {
  color: rgb(var(--v-theme-success));
}
.num {
  font-variant-numeric: tabular-nums;
}
</style>
