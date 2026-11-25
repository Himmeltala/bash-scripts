<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:25:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 08:17:26
 * @FilePath: \idex\web\src\features\editor\components\IdexCodeEditor.vue
 * @Description: idex 的代码编辑器外壳：懒加载 CodeEditorCm，向 FileEditor 注册定位方法。
-->
<template>
  <div class="idex-code-editor">
    <LoadingState v-if="loading" hint="正在准备视图…" />
    <p v-else-if="loadError" class="hint bad">{{ loadError }}</p>
    <component
      :is="Inner"
      v-else
      ref="innerRef"
      :model-value="modelValue"
      :path="path"
      :markers="markers"
      :complete="complete"
      :format="format"
      :capabilities="capabilities"
      :notice="notice"
      :theme="theme"
      :minimap="minimap"
      :diff="diff"
      @update:model-value="$emit('update:modelValue', $event)"
      v-on="forwarders"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { LoadingState } from '@bash-scripts/web-shared/layouts'
import { editorForwarders } from '../core/forwardEvents.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  path: { type: String, default: '' },
  markers: { type: Object, default: () => ({}) },
  complete: { type: Function, default: null },
  format: { type: Function, default: null },
  capabilities: { type: [Function, Object], default: () => ({}) },
  notice: { type: Function, default: null },
  theme: { type: String, default: 'auto' },
  minimap: { type: Boolean, default: false },
  diff: { type: Object, default: () => ({}) },
  // FileEditor 给的注册回调：内部编辑器就绪后交 locate/resetScroll，卸载时交 null。
  register: { type: Function, default: null },
})

const emit = defineEmits([
  'update:modelValue',
  'definition',
  'menu',
  'rename',
  'caret',
  'edit',
  'hover',
  'hover-end',
  'diffhunk',
])

const Inner = shallowRef(null)
const innerRef = ref(null)
const loading = ref(true)
const loadError = ref('')
let pendingLine = 0
const forwarders = computed(() => editorForwarders(emit, props.path))

function flushPending() {
  if (!pendingLine || !innerRef.value) return
  const line = pendingLine
  pendingLine = 0
  innerRef.value.locate(line)
}

function locate(line) {
  if (!innerRef.value) {
    pendingLine = line
    return
  }
  innerRef.value.locate(line)
}

// 内层组件真正挂上之后再补发跳行，避免注册时 innerRef 还是空。
watch(innerRef, (el) => {
  if (el) flushPending()
}, { flush: 'post' })

function resetScroll() {
  innerRef.value?.resetScroll()
}

onMounted(async () => {
  try {
    const mod = await import('./CodeEditorCm.vue')
    Inner.value = mod.default
    // 先关掉加载态，内层才会渲染出 innerRef，再等一帧后注册定位方法。
    loading.value = false
    await nextTick()
  } catch (error) {
    loadError.value = '代码视图加载失败，刷新页面再试。'
    loading.value = false
    return
  }
  flushPending()
  if (props.register) props.register({ locate, resetScroll })
})

onBeforeUnmount(() => {
  if (props.register) props.register(null)
})
</script>

<style scoped>
.idex-code-editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
