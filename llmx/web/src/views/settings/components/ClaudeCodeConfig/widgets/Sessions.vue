<template>
  <div class="sessions">
    <div class="bar">
      <v-select
        v-model="project"
        :items="projects"
        label="项目"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="pick"
      />
      <v-text-field
        v-model="search"
        label="搜索会话或项目"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        prepend-inner-icon="mdi-magnify"
        class="search"
      />
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="busy" @click="refresh">
        刷新
      </v-btn>
      <v-spacer />
      <span class="hint">
        已选 {{ selectedIds.length }} 个 · {{ formatBytes(selectedSize) }}
      </span>
      <v-btn
        color="error"
        variant="tonal"
        prepend-icon="mdi-delete-sweep-outline"
        :disabled="!selectedIds.length || !sessions.writable"
        @click="deleteOpen = true"
      >
        移进回收目录
      </v-btn>
    </div>

    <p v-if="sessions.error" class="hint bad">{{ sessions.error }}</p>
    <div class="table">
      <v-data-table
        v-model="selected"
        :headers="headers"
        :items="rows"
        item-value="id"
        show-select
        density="compact"
        fixed-header
        :loading="!sessions.loaded"
        :items-per-page="50"
      >
        <template #[`item.id`]="{ item }">
          <span class="mono" :title="item.id">{{ item.id }}</span>
        </template>
        <template #[`item.requests`]="{ item }">
          {{ item.requests || '-' }}
        </template>
        <template #[`item.tokensText`]="{ item }">
          {{ item.tokensText }}
        </template>
        <template #[`item.costText`]="{ item }">
          {{ item.costText }}
        </template>
        <template #[`item.sizeText`]="{ item }">
          {{ item.sizeText }}
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn size="small" variant="text" @click="detailId = item.id">详情</v-btn>
        </template>
      </v-data-table>
    </div>

    <p class="hint foot">
      文件目录 {{ sessions.dir }}；移走的文件进 {{ sessions.garbage }}，账本记录保留。
    </p>

    <DeleteSessionsDialog
      v-model="deleteOpen"
      :rows="selectedRows"
      :garbage="sessions.garbage"
      :submit="remove"
    />
    <SessionDetailDialog v-model="detailOpen" :id="detailId" :load="sessions.detail" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { watch } from 'vue'
import { toast } from '../../../../../composables/notice'
import { formatBytes, formatCompact, formatMoney } from '@bash-scripts/web-shared/format'
import { useClaudeSessions } from '../../../composables/ClaudeCodeConfig/useClaudeSessions'
import DeleteSessionsDialog from '../../../modals/ClaudeCodeConfig/DeleteSessionsDialog.vue'
import SessionDetailDialog from '../../../modals/ClaudeCodeConfig/SessionDetailDialog.vue'

const sessions = useClaudeSessions()
const project = ref('')
const search = ref('')
const selected = ref([])
const notice = ref('')
watch(notice, (text) => text && toast(text, 'success'))
const deleteOpen = ref(false)
const detailId = ref('')

const detailOpen = computed({
  get: () => !!detailId.value,
  set: (value) => {
    if (!value) detailId.value = ''
  },
})

const headers = [
  { title: '会话', key: 'id', width: '18%' },
  { title: '项目', key: 'project' },
  { title: '开始', key: 'started', width: 130 },
  { title: '最后活动', key: 'ended', width: 130 },
  { title: '请求', key: 'requests', align: 'end', width: 80 },
  { title: 'token', key: 'tokensText', align: 'end', width: 100 },
  { title: '费用', key: 'costText', align: 'end', width: 100 },
  { title: '大小', key: 'sizeText', align: 'end', width: 90 },
  { title: '', key: 'actions', sortable: false, align: 'end', width: 80 },
]

const projects = computed(() =>
  [...new Set(sessions.items.map((item) => item.project).filter(Boolean))].sort(),
)

const busy = ref(false)

const rows = computed(() => {
  const text = search.value.trim().toLowerCase()
  return sessions.items
    .filter((row) => (project.value ? row.project === project.value : true))
    .filter((row) => {
      if (!text) return true
      return (
        row.id.toLowerCase().includes(text) ||
        String(row.project || '').toLowerCase().includes(text)
      )
    })
    .map((row) => ({
      ...row,
      tokensText: row.total_tokens ? formatCompact(row.total_tokens) : '-',
      costText: row.cost == null ? '-' : formatMoney(row.cost),
      sizeText: formatBytes(row.size),
    }))
})

// 不同 Vuetify 版本的 v-model 可能给 id 也可能给整行，这里统一取 id。
const selectedIds = computed(() =>
  selected.value.map((item) => (typeof item === 'string' ? item : item.id)),
)

const selectedRows = computed(() =>
  sessions.items.filter((row) => selectedIds.value.includes(row.id)),
)

const selectedSize = computed(() =>
  selectedRows.value.reduce((sum, row) => sum + (row.size || 0), 0),
)

async function refresh() {
  busy.value = true
  try {
    await sessions.refresh()
  } finally {
    busy.value = false
  }
}

async function remove(ids) {
  const data = await sessions.trash(ids ?? selectedIds.value)
  selected.value = []
  notice.value = `已移走 ${data.moved} 个文件到 ${data.garbage}`
  return data
}

onMounted(refresh)
</script>

<style scoped>
.sessions {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-bottom: 0.5rem;
}

.pick {
  flex: 0 0 12rem;
}

.search {
  flex: 0 1 18rem;
}

/* 表格自己滚，底下的目录说明才不会被长表格压住：不把高度收在容器里，
   v-table 会按内容长出去，行直接盖到说明文字上。 */
.table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table :deep(.v-data-table) {
  flex: 1 1 auto;
  min-height: 0;
}

.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.hint.bad {
  color: rgb(var(--v-theme-error));
}

.foot {
  flex: none;
  padding-top: 0.5rem;
  word-break: break-all;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
}
</style>
