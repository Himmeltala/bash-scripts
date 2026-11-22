<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { alerts, budgets, loadBudgets, refreshSpend, saveBudgets, spend, toneOf } from '../composables/useBudgets'
import { fmtMoney } from '../composables/format'
import { toast } from '../../../composables/notice'

const open = ref(false)
const saving = ref(false)
const draft = ref({ daily: 0, weekly: 0, monthly: 0 })

const periods = computed(() => [
  { key: 'daily', name: '日', spent: spend.value.daily, limit: Number(budgets.value.daily) || 0 },
  { key: 'weekly', name: '周', spent: spend.value.weekly, limit: Number(budgets.value.weekly) || 0 },
  { key: 'monthly', name: '月', spent: spend.value.monthly, limit: Number(budgets.value.monthly) || 0 },
])

const configured = computed(() => periods.value.filter((item) => item.limit > 0))

function tone(item) {
  return toneOf(item.spent, item.limit)
}

async function startEdit() {
  try {
    await loadBudgets()
  } catch (err) {
    toast(err.message, 'error')
    return
  }
  draft.value = {
    daily: Number(budgets.value.daily) || 0,
    weekly: Number(budgets.value.weekly) || 0,
    monthly: Number(budgets.value.monthly) || 0,
  }
  open.value = true
}

async function save() {
  saving.value = true
  try {
    await saveBudgets({
      ...budgets.value,
      daily: Math.max(0, Number(draft.value.daily) || 0),
      weekly: Math.max(0, Number(draft.value.weekly) || 0),
      monthly: Math.max(0, Number(draft.value.monthly) || 0),
    })
    open.value = false
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    saving.value = false
  }
}

let timer = 0
onMounted(() => {
  loadBudgets().catch((err) => toast(err.message, 'error'))
  timer = setInterval(refreshSpend, 5 * 60 * 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="wrap">
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
    </div>

    <v-alert
      v-for="item in alerts"
      :key="item.text"
      :type="item.level === 'bad' ? 'error' : 'warning'"
      variant="tonal"
      density="compact"
      class="alert"
    >
      {{ item.text }}
    </v-alert>

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
          <v-btn color="primary" variant="flat" :loading="saving" @click="save">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.wrap {
  margin-bottom: 6px;
}
.budget {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.alert {
  margin-top: 4px;
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
