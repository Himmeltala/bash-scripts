<template>
  <div class="list">
    <div class="head">
      <span class="head-title">工作区</span>
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-plus"
        :loading="busy"
        @click="openDialog"
      >
        添加
      </v-btn>
    </div>

    <div v-if="!workspaces.length" class="none">还没有工作区</div>

    <v-list density="compact" nav class="items">
      <v-list-item
        v-for="ws in workspaces"
        :key="ws.id"
        :active="ws.id === current"
        active-color="primary"
        @click="$emit('select', ws.id)"
      >
        <v-list-item-title class="name">{{ baseName(ws.root) }}</v-list-item-title>
        <v-list-item-subtitle class="path" :title="ws.root">{{ ws.root }}</v-list-item-subtitle>
        <template #append>
          <v-btn
            :icon="true"
            size="x-small"
            variant="text"
            title="移出工作区"
            class="forget"
            @click.stop="confirm(ws)"
          >
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <v-dialog v-model="dialog" max-width="620">
      <v-card>
        <v-card-title>添加工作区</v-card-title>
        <v-card-text>
          <DirectoryPicker :key="dialogKey" v-model="path" @update:valid="pathOk = $event" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!path.trim() || !pathOk" @click="submit">
            添加此目录
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="asking" max-width="440">
      <v-card>
        <v-card-title>移出工作区</v-card-title>
        <v-card-text>
          {{ asking ? asking.root : '' }}
          <p class="tip">登记的服务与日志一起删掉，正在跑的进程会先停掉。工程目录本身不动。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="asking = null">取消</v-btn>
          <v-btn color="error" variant="flat" @click="drop">移出</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DirectoryPicker from './DirectoryPicker.vue'

defineProps({
  workspaces: { type: Array, required: true },
  current: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'add', 'remove'])

const dialog = ref(false)
const path = ref('')
const pathOk = ref(false)
// 每次打开换一个 key，目录树重新从家目录拉，不带着上次展开的状态。
const dialogKey = ref(0)
const asking = ref(null)

function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : full
}

function openDialog() {
  path.value = ''
  pathOk.value = false
  dialogKey.value += 1
  dialog.value = true
}

function submit() {
  const value = path.value.trim()
  if (!value) return
  dialog.value = false
  emit('add', value)
}

function confirm(ws) {
  asking.value = ws
}

function drop() {
  const ws = asking.value
  asking.value = null
  if (ws) emit('remove', ws.id)
}
</script>

<style scoped>
.list {
  padding: 8px 4px 16px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
}
.head-title {
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.none {
  padding: 12px 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
}
.items :deep(.v-list-item) {
  border-radius: 8px;
}
.name {
  font-weight: 500;
}
.path {
  font-size: 0.74rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.forget {
  opacity: 0;
  transition: opacity 0.15s;
}
.items :deep(.v-list-item:hover) .forget {
  opacity: 1;
}
.tip {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.86rem;
  margin: 0 0 12px;
}
</style>
