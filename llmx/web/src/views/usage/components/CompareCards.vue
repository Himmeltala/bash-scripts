<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { previous } from '../composables/useCompare'
import { fmtMoney, fmtNum, fmtTokens } from '../lib/format'

function rate(now, before) {
  const value = Number(now)
  const old = Number(before)
  if (!Number.isFinite(value) || !Number.isFinite(old) || old === 0) return null
  return ((value - old) / old) * 100
}

function deltaText(percent) {
  if (percent == null) return '没有可比数据'
  if (Math.abs(percent) < 0.05) return '与上一周期持平'
  return `较上一周期${percent > 0 ? '增加' : '减少'} ${Math.abs(percent).toFixed(1)}%`
}

const items = computed(() => {
  const now = data.value?.totals
  const before = previous.value?.totals
  if (!now || !before) return []
  const cost = rate(now.cost, before.cost)
  const hitNow = now.cache_hit == null ? null : Number(now.cache_hit) * 100
  const hitBefore = before.cache_hit == null ? null : Number(before.cache_hit) * 100
  const hitDelta = hitNow == null || hitBefore == null ? null : hitNow - hitBefore
  return [
    {
      title: '合计',
      value: `¥${fmtMoney(now.cost || 0)}`,
      detail: deltaText(cost),
      tone: cost == null ? '' : cost > 0 ? 'bad' : cost < 0 ? 'good' : '',
    },
    {
      title: '请求',
      value: fmtNum(now.requests),
      detail: deltaText(rate(now.requests, before.requests)),
    },
    {
      title: '总 token',
      value: fmtTokens(now.total_tokens),
      detail: deltaText(rate(now.total_tokens, before.total_tokens)),
    },
    {
      title: '缓存命中',
      value: hitNow == null ? '--' : `${hitNow.toFixed(1)}%`,
      detail:
        hitDelta == null
          ? '没有可比数据'
          : `${hitDelta >= 0 ? '提高' : '降低'} ${Math.abs(hitDelta).toFixed(1)} 个百分点`,
      tone: hitDelta == null ? '' : hitDelta > 0 ? 'good' : hitDelta < 0 ? 'bad' : '',
    },
  ]
})
</script>

<template>
  <v-card v-if="items.length" variant="flat" class="compare">
    <v-card-text class="row">
      <div v-for="item in items" :key="item.title" class="cell">
        <span class="title">{{ item.title }}</span>
        <span class="value">{{ item.value }}</span>
        <span class="detail" :class="item.tone">{{ item.detail }}</span>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.compare {
  margin-bottom: 8px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 10px 16px;
}
.cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
}
.title {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.74rem;
}
.value {
  font-size: 1.05rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.detail {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.74rem;
}
.detail.bad {
  color: rgb(var(--v-theme-error));
}
.detail.good {
  color: rgb(var(--v-theme-success));
}
</style>
