<template>
  <div class="list">
    <div class="head">
      <span class="head-title">{{ labels.headTitle }}</span>
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-plus"
        :loading="busy"
        @click="openDialog"
      >
        {{ labels.add }}
      </v-btn>
    </div>

    <div v-if="!workspaces.length" class="none">{{ labels.empty }}</div>

    <v-list density="compact" nav class="items">
      <v-list-item
        v-for="ws in workspaces"
        :key="ws.id"
        :active="ws.id === current"
        active-color="primary"
        @click="$emit('select', ws.id)"
        @contextmenu.prevent.stop="openMenu($event, ws)"
      >
        <v-list-item-title class="name" :title="ws.alias ? ws.root : ''">
          {{ ws.alias || baseName(ws.root) }}
          <slot name="title-extra" :ws="ws" />
        </v-list-item-title>
        <v-list-item-subtitle class="path" :title="ws.url || ws.root">
          {{ ws.url || ws.root }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            :icon="true"
            size="x-small"
            variant="text"
            :title="labels.forgetTitle"
            class="forget"
            @click.stop="confirm(ws)"
          >
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <div
      v-if="menu.open"
      class="ctxmenu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <button type="button" class="ctxitem" @click="startAlias(menu.ws)">
        <v-icon size="16">mdi-rename-box</v-icon>{{ labels.menuAlias }}
      </button>
      <button type="button" class="ctxitem" @click="copyPath(menu.ws, 'rel')">
        <v-icon size="16">mdi-content-copy</v-icon>{{ labels.copyRel }}
      </button>
      <button type="button" class="ctxitem" @click="copyPath(menu.ws, 'abs')">
        <v-icon size="16">mdi-content-copy</v-icon>{{ labels.copyAbs }}
      </button>
    </div>

    <v-dialog v-model="aliasOn" max-width="460">
      <v-card>
        <v-card-title>{{ labels.aliasTitle }}</v-card-title>
        <v-card-text>
          <p class="tip">{{ aliasTarget ? aliasTarget.root : '' }}</p>
          <v-text-field
            v-model="aliasText"
            label="别名"
            density="compact"
            variant="outlined"
            maxlength="80"
            clearable
            autofocus
            @keyup.enter="saveAlias"
          />
          <p class="tip">{{ labels.aliasHint }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="aliasOn = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="aliasSaving" @click="saveAlias">
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog" max-width="620">
      <v-card>
        <v-card-title>{{ labels.addTitle }}</v-card-title>
        <v-card-text>
          <DirectoryPicker
            :key="dialogKey"
            v-model="path"
            :tip="labels.addTip"
            :label="labels.addLabel"
            :placeholder="labels.addPlaceholder"
            :loader="dirs"
            @update:valid="pathOk = $event"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!path.trim() || !pathOk" @click="submit">
            {{ labels.addConfirm }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="asking" max-width="440">
      <v-card>
        <v-card-title>{{ labels.removeTitle }}</v-card-title>
        <v-card-text>
          {{ asking ? asking.root : '' }}
          <p class="tip">{{ labels.removeText }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="asking = null">取消</v-btn>
          <v-btn color="error" variant="flat" @click="drop">{{ labels.removeConfirm }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { DirectoryPicker } from './DirectoryPicker/index.js'
import { copyText } from '../utils/clipboard.js'

const props = defineProps({
  workspaces: { type: Array, required: true },
  current: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  // 选目录与存别名的接口由调用方给，组件不认具体后端。
  dirs: { type: Function, required: true },
  saveAlias: { type: Function, required: true },
  texts: { type: Object, default: () => ({}) },
})

const DEFAULTS = {
  headTitle: '工作区',
  add: '添加',
  empty: '还没有工作区',
  forgetTitle: '移出工作区',
  menuAlias: '设置别名',
  copyRel: '复制相对路径',
  copyAbs: '复制绝对路径',
  aliasTitle: '设置别名',
  aliasHint: '留空表示不用别名，显示目录名。',
  aliasSaved: '别名已保存',
  aliasFailed: '保存别名失败：',
  copied: '已复制：',
  copyFailed: '复制失败，浏览器不允许访问剪贴板',
  addTitle: '添加工作区',
  addTip: '选工程所在的目录。',
  addLabel: '工程目录',
  addPlaceholder: '~/pros/项目名',
  addConfirm: '添加此目录',
  removeTitle: '移出工作区',
  removeText: '只是从列表里移出，工程目录本身不动。',
  removeConfirm: '移出',
}
const labels = computed(() => ({ ...DEFAULTS, ...props.texts }))

const emit = defineEmits(['select', 'add', 'remove', 'changed', 'notice'])

const dialog = ref(false)
const path = ref('')
const pathOk = ref(false)
// 每次打开换一个 key，目录树重新从家目录拉，不带着上次展开的状态。
const dialogKey = ref(0)
const asking = ref(null)

const menu = reactive({ open: false, x: 0, y: 0, ws: null })
const aliasOn = ref(false)
const aliasTarget = ref(null)
const aliasText = ref('')
const aliasSaving = ref(false)

function openMenu(event, ws) {
  // 靠近右边缘或下边缘时往回收，菜单不至于跑出窗口。
  menu.x = Math.max(8, Math.min(event.clientX, window.innerWidth - 190))
  menu.y = Math.max(8, Math.min(event.clientY, window.innerHeight - 130))
  menu.ws = ws
  menu.open = true
}

function closeMenu() {
  menu.open = false
}

function startAlias(ws) {
  aliasTarget.value = ws
  aliasText.value = ws.alias || ''
  aliasOn.value = true
  closeMenu()
}

async function saveAlias() {
  if (!aliasTarget.value) return
  aliasSaving.value = true
  try {
    await props.saveAlias(aliasTarget.value.id, (aliasText.value || '').trim())
    aliasOn.value = false
    emit('changed')
    emit('notice', { text: labels.value.aliasSaved, color: 'primary' })
  } catch (err) {
    emit('notice', { text: `${labels.value.aliasFailed}${err.message}`, color: 'error' })
  } finally {
    aliasSaving.value = false
  }
}

async function copyPath(ws, kind) {
  const text = kind === 'rel' ? ws.rel || ws.root : ws.root
  const ok = await copyText(text)
  emit('notice', {
    text: ok ? `${labels.value.copied}${text}` : labels.value.copyFailed,
    color: ok ? 'primary' : 'error',
  })
  closeMenu()
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
  document.addEventListener('contextmenu', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('blur', closeMenu)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('contextmenu', closeMenu)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('blur', closeMenu)
})

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
.ctxmenu {
  position: fixed;
  z-index: 3000;
  min-width: 180px;
  padding: 4px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
}
.ctxitem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.84rem;
  text-align: left;
  cursor: pointer;
}
.ctxitem:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
</style>
