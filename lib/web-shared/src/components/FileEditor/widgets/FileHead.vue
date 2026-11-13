<template>
  <div class="file-head">
    <nav class="crumbs">
      <button class="seg" title="回到根目录" @click="emit('navigate', '')">{{ rootName }}</button>
      <template v-for="(seg, i) in crumbs" :key="seg.path">
        <span class="sep">/</span>
        <button
          class="seg"
          :class="{ last: i === crumbs.length - 1 }"
          :title="seg.path"
          @click="clickCrumb(seg, i)"
        >
          {{ seg.name }}
        </button>
      </template>
    </nav>
    <span class="meta">{{ sizeText }}</span>
    <slot name="actions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rootName: { type: String, default: '/' },
  path: { type: String, default: '' },
  size: { type: Number, default: undefined },
})

const emit = defineEmits(['navigate'])

const crumbs = computed(() => {
  const parts = String(props.path || '').split('/').filter(Boolean)
  let acc = ''
  return parts.map((name) => {
    acc = acc ? `${acc}/${name}` : name
    return { name, path: acc }
  })
})

const sizeText = computed(() => {
  if (props.size === undefined || props.size === null) return ''
  const bytes = Number(props.size) || 0
  if (bytes < 1024) return `${bytes} 字节`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
})

function clickCrumb(seg, index) {
  // 最后一段就是当前文件，点了不动。
  if (index === crumbs.value.length - 1) return
  emit('navigate', seg.path)
}
</script>

<style scoped src="./FileHead.css"></style>
