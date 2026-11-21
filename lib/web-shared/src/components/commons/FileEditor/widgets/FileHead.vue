<template>
  <div class="file-head">
    <nav class="crumbs">
      <span class="seg" :title="rootName">{{ rootName }}</span>
      <template v-for="(seg, i) in crumbs" :key="seg.path">
        <span class="sep">/</span>
        <span class="seg" :class="{ last: i === crumbs.length - 1 }" :title="seg.path">
          {{ seg.name }}
        </span>
      </template>
    </nav>
    <slot name="actions" />
    <span class="meta">{{ sizeText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rootName: { type: String, default: '/' },
  path: { type: String, default: '' },
  size: { type: Number, default: undefined },
})

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

</script>

<style scoped src="./FileHead.css"></style>
