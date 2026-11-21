<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { budgets, refreshSpend, spend } from '../composables/useBudgets'
import { fmtMoney } from '../composables/format'

const open = ref(false)
const draft = ref({ daily: 0, weekly: 0, monthly: 0 })

const periods = computed(() => [
  { key: 'daily', name: '日', spent: spend.value.daily, limit: Number(budgets.value.daily) || 0 },
  { key: 'weekly', name: '周', spent: spend.value.weekly, limit: Number(budgets.value.weekly) || 0 },
  { key: 'monthly', name: '月', spent: spend.value.monthly, limit: Number(budgets.value.monthly) || 0 },
])

const configured = computed(() => periods.value.filter((item) => item.limit > 0))

function tone(item) {
  if (!item.limit) return ''
  const ratio = item.spent / item.limit
  if (ratio >= 1) return 'bad'
  if (ratio >= 0.8) return 'warn'
  return ''
}

function startEdit() {
  draft.value = {
    daily: Number(budgets.value.daily) || 0,
    weekly: Number(budgets.value.weekly) || 0,
    monthly: Number(budgets.value.monthly) || 0,
  }
  open.value = true
}

function save() {
  budgets.value = {
    ...budgets.value,
    daily: Math.max(0, Number(draft.value.daily) || 0),
    weekly: Math.max(0, Number(draft.value.weekly) || 0),
    monthly: Math.max(0, Number(draft.value.monthly) || 0),
  }
  open.value = false
  refreshSpend()
}

let timer = 0
onMounted(() => {
  refreshSpend()
  timer = setInterval(refreshSpend, 5 * 60 * 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="budget">
    <template v-if="configured.length">
      <span class="label">预算</span>
      <span
        v-for="item in configured"
        :key="item.key"
        class="item"
        :class="tone(item)"
        :title="`${item.name}预算 ¥${fmtMoney(item.limit)}`"
      >
        {{ item.name }} ¥{{ fmtMoney(item.spent) }} / ¥{{ fmtMoney(item.limit) }}
      </span>
    </template>
    <v-btn size="small" variant="text" prepend-icon="mdi-wallet-outline" @click="startEdit">
      {{ configured.length ? '设置预算' : '预算' }}
    </v-btn>

    <v-dialog v-model="open" max-width="460">
      <v-card>
        <v-card-title>预算</v-card-title>
        <v-card-text class="fields">
          <v-text-field
            v-model.number="draft.daily"
            type="number"
            min="0"
            label="每日上限（元，0 表示不设）"
            density="compact"
            variant="outlined"
          />
          <v-text-field
            v-model.number="draft.weekly"
            type="number"
            min="0"
            label="每周上限（元，0 表示不设）"
            density="compact"
            variant="outlined"
          />
          <v-text-field
            v-model.number="draft.monthly"
            type="number"
            min="0"
            label="每月上限（元，0 表示不设）"
            density="compact"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="open = false">取消</v-btn>
          <v-btn color="primary" variant="flat" @click="save">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.budget {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.label {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.76rem;
  letter-spacing: 0.06em;
}
.item {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.item.warn {
  color: rgb(var(--v-theme-peak));
}
.item.bad {
  color: rgb(var(--v-theme-error));
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
