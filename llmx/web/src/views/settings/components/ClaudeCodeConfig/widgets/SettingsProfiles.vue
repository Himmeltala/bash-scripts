<template>
  <div class="profiles">
    <aside class="list">
      <div class="head">
        <span class="head-title">配置档</span>
        <v-spacer />
        <v-btn size="small" variant="text" icon="mdi-refresh" title="刷新" @click="profiles.refresh()" />
        <v-btn
          size="small"
          variant="text"
          color="primary"
          prepend-icon="mdi-plus"
          :disabled="!profiles.writable"
          @click="openNew()"
        >
          新建
        </v-btn>
      </div>

      <p v-if="profiles.error" class="hint bad">{{ profiles.error }}</p>
      <div v-if="!profiles.loaded" class="hint">正在读取配置档…</div>
      <div v-else-if="!profiles.items.length" class="hint">
        还没有配置档。新建一份，或从当前 settings.json 复制。
      </div>
      <v-list v-else nav density="compact" class="items">
        <v-list-item
          v-for="item in profiles.items"
          :key="item.name"
          :active="selected?.name === item.name"
          @click="select(item)"
        >
          <v-list-item-title>
            {{ item.name }}
            <v-chip v-if="item.applied" size="x-small" color="primary" variant="flat" class="ml-2">
              生效
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle>{{ item.updated.replace('T', ' ') }}</v-list-item-subtitle>
          <template #append>
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon="mdi-dots-vertical"
                  size="x-small"
                  variant="text"
                  title="更多"
                  @click.stop
                />
              </template>
              <v-list density="compact">
                <v-list-item title="重命名" @click="renameTarget = item" />
                <v-list-item title="复制一份" @click="openNew(item)" />
                <v-list-item title="删除" @click="deleteTarget = item" />
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </v-list>
      <p class="hint dir">{{ profiles.dir }}</p>
    </aside>

    <section class="pane">
      <div class="bar">
        <span class="name">{{ selected ? selected.name : '未选择配置档' }}</span>
        <v-chip v-if="selected?.applied" size="x-small" color="primary" variant="tonal">
          当前生效
        </v-chip>
        <v-chip v-else-if="selected" size="x-small" variant="tonal">未应用</v-chip>
        <v-chip v-if="changed" size="x-small" variant="tonal" color="warning">已改动</v-chip>
        <span v-if="notice" class="hint">{{ notice }}</span>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canApply"
          @click="startApply"
        >
          应用
        </v-btn>
      </div>
      <div class="editor">
        <FileEditor
          ref="editorRef"
          root-name="Claude Code"
          :loader="loadFile"
          :saver="saveFile"
          @saved="onSaved"
        />
      </div>
    </section>

    <NewProfileDialog
      v-model="newOpen"
      :existing="names"
      :has-target="profiles.target.exists"
      :preset="preset"
      :submit="createProfile"
    />
    <RenameProfileDialog
      v-model="renameOpen"
      :current="renameTarget?.name || ''"
      :submit="renameProfile"
    />
    <DeleteProfileDialog
      v-model="deleteOpen"
      :name="deleteTarget?.name || ''"
      :submit="removeProfile"
    />
    <ApplyProfileDialog
      v-model="applyOpen"
      :name="applyTarget?.name || ''"
      :load="loadDiff"
      :submit="applySelected"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { FileEditor } from '@bash-scripts/web-shared'
import { useClaudeProfiles } from '../../../composables/ClaudeCodeConfig/useClaudeProfiles'
import NewProfileDialog from '../../../modals/ClaudeCodeConfig/NewProfileDialog.vue'
import RenameProfileDialog from '../../../modals/ClaudeCodeConfig/RenameProfileDialog.vue'
import DeleteProfileDialog from '../../../modals/ClaudeCodeConfig/DeleteProfileDialog.vue'
import ApplyProfileDialog from '../../../modals/ClaudeCodeConfig/ApplyProfileDialog.vue'

const profiles = useClaudeProfiles()
const editorRef = ref(null)
const selected = ref(null)
const notice = ref('')

const newOpen = ref(false)
const preset = ref(null)
const renameTarget = ref(null)
const deleteTarget = ref(null)
const applyTarget = ref(null)

const renameOpen = computed({
  get: () => !!renameTarget.value,
  set: (value) => {
    if (!value) renameTarget.value = null
  },
})
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (value) => {
    if (!value) deleteTarget.value = null
  },
})
const applyOpen = computed({
  get: () => !!applyTarget.value,
  set: (value) => {
    if (!value) applyTarget.value = null
  },
})

const names = computed(() => profiles.items.map((item) => item.name))
const changed = computed(
  () => profiles.target.exists && !profiles.items.some((item) => item.applied),
)
const canApply = computed(
  () => !!selected.value && !selected.value.applied && profiles.writable,
)

function loadFile() {
  if (!selected.value) return Promise.reject(new Error('还没选配置档'))
  return profiles.load(selected.value.name)
}

function saveFile(path, text) {
  return profiles.save(selected.value.name, text)
}

async function select(item) {
  if (selected.value?.name === item.name) return
  const editor = editorRef.value
  if (editor?.dirty) {
    const leave = await editor.confirmLeave()
    if (!leave) return
  }
  selected.value = item
  notice.value = ''
  await nextTick()
  await editorRef.value?.open(`${item.name}.json`)
}

function refreshSelected() {
  if (!selected.value) return
  const fresh = profiles.items.find((item) => item.name === selected.value.name)
  if (fresh) selected.value = fresh
}

async function onSaved() {
  await profiles.refresh()
  refreshSelected()
}

function openNew(item = null) {
  preset.value = item
    ? { name: `${item.name} 副本`, from: 'profile', source: item.name }
    : null
  newOpen.value = true
}

async function createProfile(payload) {
  const data = await profiles.create(payload)
  const item = profiles.items.find((entry) => entry.name === data.name)
  if (item) await select(item)
  return data
}

async function renameProfile(to) {
  const from = renameTarget.value?.name
  if (!from) return
  if (editorRef.value?.dirty && selected.value?.name === from) {
    throw new Error('这份配置档还有未保存的改动，先保存再改名')
  }
  const data = await profiles.rename(from, to)
  if (selected.value?.name === from) {
    selected.value = profiles.items.find((item) => item.name === to) || {
      ...selected.value,
      name: to,
    }
    await nextTick()
    await editorRef.value?.open(`${to}.json`)
  }
  return data
}

async function removeProfile() {
  const name = deleteTarget.value?.name
  if (!name) return
  const data = await profiles.remove(name)
  if (selected.value?.name === name) {
    editorRef.value?.close()
    selected.value = null
    const next = profiles.items[0]
    if (next) await select(next)
  }
  return data
}

function startApply() {
  if (editorRef.value?.dirty) {
    notice.value = '这份配置档还有未保存的改动，先保存再应用'
    return
  }
  notice.value = ''
  applyTarget.value = selected.value
}

function loadDiff(name) {
  return profiles.diff(name)
}

async function applySelected() {
  const data = await profiles.apply(applyTarget.value.name)
  refreshSelected()
  notice.value = data.backup
    ? `已应用，原配置备份在 ${data.backup}`
    : '已应用，目标文件原来不存在，没有备份'
  return data
}

onMounted(async () => {
  await profiles.refresh()
  const first = profiles.items.find((item) => item.applied) || profiles.items[0]
  if (first) await select(first)
})
</script>

<style scoped>
.profiles {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 0.75rem;
}

.list {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-right: 0.5rem;
  overflow: auto;
}

.head {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem 0.5rem;
}

.head-title {
  font-weight: 600;
}

.items {
  flex: 1 1 auto;
  overflow: auto;
}

.pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  flex: none;
}

.name {
  font-weight: 600;
}

.editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.editor > * {
  flex: 1 1 auto;
  min-width: 0;
}

.dir {
  flex: none;
  word-break: break-all;
  padding: 0 0.5rem;
}

.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 0.25rem 0.5rem;
}

.hint.bad {
  color: rgb(var(--v-theme-error));
}
</style>
