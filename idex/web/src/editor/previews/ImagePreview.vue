<!--
 * @Author: Himmeltala
 * @Date: 2026-11-19 23:58:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 23:58:00
 * @FilePath: \idex\web\src\editor\previews\ImagePreview.vue
 * @Description: 图片预览：默认缩进窗口，点一下看原始大小，角上标出尺寸与文件大小。
-->
<template>
  <div
    class="image-pane"
    :class="{ actual: zoom }"
    :title="zoom ? '点击适应窗口' : '点击原始大小'"
    @click="zoom = !zoom"
  >
    <img :src="url" :alt="name" @load="readDims" />
    <div class="image-meta">
      <span>{{ meta }}</span>
      <button v-if="svg" type="button" class="image-act" @click.stop="emit('source')">
        查看源码
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { isSvgPath } from './previewTypes'

const props = defineProps({
  url: { type: String, required: true },
  name: { type: String, default: '' },
  path: { type: String, default: '' },
  size: { type: Number, default: 0 },
})
const emit = defineEmits(['source'])

const zoom = ref(false)
const dims = ref(null)
const svg = computed(() => isSvgPath(props.path))

function readDims(event) {
  dims.value = { width: event.target.naturalWidth, height: event.target.naturalHeight }
}

const meta = computed(() => {
  const parts = []
  if (dims.value) parts.push(`${dims.value.width} × ${dims.value.height}`)
  if (props.size) parts.push(formatBytes(props.size))
  return parts.join(' · ') || props.name
})
</script>

<style scoped>
/* 棋盘格衬底方便看透明区域；默认缩进窗口，点一下按原始大小并可滚动。 */
.image-pane {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: auto;
  cursor: zoom-in;
  background-color: rgb(var(--v-theme-surface));
  background-image: repeating-conic-gradient(
    rgba(var(--v-theme-on-surface), 0.05) 0% 25%,
    transparent 0% 50%
  );
  background-size: 16px 16px;
}
.image-pane.actual {
  align-items: flex-start;
  justify-content: flex-start;
  cursor: zoom-out;
}
.image-pane img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}
.image-pane.actual img {
  max-width: none;
  max-height: none;
  flex: 0 0 auto;
}
.image-meta {
  position: absolute;
  left: 10px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-surface), 0.86);
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.72rem;
  pointer-events: none;
}
.image-act {
  padding: 2px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
  font-size: 0.72rem;
  cursor: pointer;
  pointer-events: auto;
}
.image-act:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}
</style>
