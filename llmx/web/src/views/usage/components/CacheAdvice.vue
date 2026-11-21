<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { fmtMoney } from '../composables/format'

// 按模型与项目合计，估算把缓存命中提到 99% 后这一段范围能省多少。
// 只按模型合在一起会把某个项目的低命中摊平，看不出问题出在哪。
const advice = computed(() => {
  const groups = new Map()
  for (const row of data.value?.rows || []) {
    const model = row.model || '未知'
    const project = row.project || '未记录'
    const key = `${model}\u0000${project}`
    const group = groups.get(key) || {
      model,
      project,
      input: 0,
      cache_read: 0,
      cost_input: 0,
      cost_cache_read: 0,
    }
    group.input += Number(row.input) || 0
    group.cache_read += Number(row.cache_read) || 0
    group.cost_input += Number(row.cost_input) || 0
    group.cost_cache_read += Number(row.cost_cache_read) || 0
    groups.set(key, group)
  }
  const out = []
  for (const group of groups.values()) {
    const cached = group.input + group.cache_read
    if (!group.input || !cached) continue
    const hit = group.cache_read / cached
    if (hit >= 0.99) continue
    const target = group.input * 99
    const converted = target - group.cache_read
    if (converted <= 0) continue
    const missUnit = group.input ? group.cost_input / group.input : 0
    const hitUnit = group.cache_read ? group.cost_cache_read / group.cache_read : 0
    const saved = converted * Math.max(0, missUnit - hitUnit)
    if (saved <= 0) continue
    out.push({ model: group.model, project: group.project, hit, saved })
  }
  out.sort((a, b) => b.saved - a.saved)
  return out.slice(0, 5)
})
</script>

<template>
  <v-card v-if="advice.length" variant="flat" class="advice">
    <v-card-text>
      <div class="head">缓存优化建议</div>
      <p class="hint">按本报表当前范围估算，把命中率提到 99% 可省：</p>
      <ul class="list">
        <li v-for="item in advice" :key="`${item.model}/${item.project}`" class="item">
          <span class="model">{{ item.model }}</span>
          <span class="project">{{ item.project }}</span>
          <span class="meta">当前命中 {{ (item.hit * 100).toFixed(1) }}%</span>
          <span class="saved">约省 ¥{{ fmtMoney(item.saved) }}</span>
        </li>
      </ul>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.advice {
  margin-top: 8px;
}
.head {
  font-size: 0.9rem;
  font-weight: 600;
}
.hint {
  margin: 4px 0 6px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
}
.list {
  margin: 0;
  padding-left: 1.1em;
}
.item {
  margin-bottom: 3px;
  font-size: 0.8rem;
}
.model {
  font-weight: 500;
}
.project {
  margin-left: 6px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.76rem;
}
.meta {
  margin-left: 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.saved {
  margin-left: 8px;
  color: rgb(var(--v-theme-success));
}
</style>
