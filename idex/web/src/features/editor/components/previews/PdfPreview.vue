<!--
 * @Author: Himmeltala
 * @Date: 2026-11-28 20:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 20:20:00
 * @FilePath: \idex\web\src\features\editor\components\previews\PdfPreview.vue
 * @Description: Office 预览：后端用 LibreOffice 转好的 PDF，这里按页懒渲染并支持缩放。
-->
<template>
  <div class="pdf-pane">
    <LoadingState v-if="state === 'loading'" hint="正在转换并解析文档…" />

    <EmptyState
      v-else-if="state === 'error'"
      icon="mdi-alert-circle-outline"
      :icon-size="40"
      :path="path"
      :hint="error || '无法预览这个文档。'"
    >
      <template #actions>
        <v-btn variant="text" prepend-icon="mdi-refresh" @click="load">重试</v-btn>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-download" :href="url" download>
          下载文件
        </v-btn>
      </template>
    </EmptyState>

    <template v-else>
      <div class="pdf-bar">
        <span class="pdf-count">{{ pageCount }} 页</span>
        <v-btn icon size="x-small" variant="text" title="缩小" @click="zoomBy(-0.1)">
          <v-icon size="16">mdi-magnify-minus-outline</v-icon>
        </v-btn>
        <span class="pdf-zoom">{{ Math.round(scale * 100) }}%</span>
        <v-btn icon size="x-small" variant="text" title="放大" @click="zoomBy(0.1)">
          <v-icon size="16">mdi-magnify-plus-outline</v-icon>
        </v-btn>
        <v-btn size="small" variant="text" @click="fitWidth">适应宽度</v-btn>
      </div>
      <div ref="scroller" class="pdf-scroll">
        <div class="pdf-list">
          <div
            v-for="(page, index) in pages"
            :key="page.num"
            :ref="(el) => setSlot(index, el)"
            class="pdf-page"
            :class="{ done: page.rendered }"
            :style="{ width: `${page.width}px`, height: `${page.height}px` }"
          >
            <span v-if="!page.rendered" class="pdf-wait">{{ page.num }}</span>
            <div :ref="(el) => setHost(index, el)" class="pdf-canvas" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { EmptyState, LoadingState } from '@bash-scripts/web-shared/layouts'

const props = defineProps({
  url: { type: String, required: true },
  name: { type: String, default: '' },
  path: { type: String, default: '' },
  size: { type: Number, default: 0 },
})

const state = ref('loading')
const error = ref('')
const scale = ref(1)
const pages = ref([])
const pageCount = ref(0)
const scroller = ref(null)

let doc = null
let observer = null
let resizeObserver = null
let base = { width: 612, height: 792 }
let fitMode = true
let renderVersion = 0
const slots = []
const hosts = []
const renderTasks = new Map()

function setSlot(index, el) {
  slots[index] = el
  if (el && observer) observer.observe(el)
}

// canvas 挂在独立的容器里，不动 Vue 渲染的等待文字。
function setHost(index, el) {
  hosts[index] = el
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function computeFit() {
  const width = (scroller.value?.clientWidth || 720) - 48
  return clamp(width / base.width, 0.2, 3)
}

function applyScale(next, keepFit) {
  fitMode = !!keepFit
  scale.value = clamp(next, 0.2, 3)
  resetPages()
}

function zoomBy(delta) {
  applyScale(scale.value + delta, false)
}

function fitWidth() {
  applyScale(computeFit(), true)
}

function resetPages() {
  renderVersion += 1
  for (const task of renderTasks.values()) {
    try {
      task.cancel()
    } catch (err) {
      // 已结束的任务取消会抛，忽略。
    }
  }
  renderTasks.clear()
  for (const page of pages.value) {
    page.width = Math.round(base.width * scale.value)
    page.height = Math.round(base.height * scale.value)
    page.rendered = false
  }
  for (const host of hosts) host?.replaceChildren()
  // 重新观察会让当前可见的页立即重画；离得远的等滚过去再画。
  if (observer) {
    observer.disconnect()
    for (const slot of slots) {
      if (slot) observeSlot(slot)
    }
  }
}

function observeSlot(slot) {
  if (!observer) return
  const index = slots.indexOf(slot)
  const page = pages.value[index]
  if (page) observer.observe(slot)
}

async function renderPage(index, slot) {
  const page = pages.value[index]
  if (!page || !doc || page.rendered) return
  const version = renderVersion
  if (renderTasks.has(index)) return
  try {
    const pdfPage = await doc.getPage(page.num)
    if (version !== renderVersion) return
    const viewport = pdfPage.getViewport({ scale: scale.value })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr))
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr))
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    const context = canvas.getContext('2d')
    const task = pdfPage.render({
      canvasContext: context,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
    })
    renderTasks.set(index, task)
    await task.promise
    renderTasks.delete(index)
    if (version !== renderVersion) return
    const host = hosts[index]
    if (!host) return
    host.replaceChildren(canvas)
    page.width = Math.round(viewport.width)
    page.height = Math.round(viewport.height)
    page.rendered = true
  } catch (err) {
    if (err && err.name === 'RenderingCancelledException') return
    renderTasks.delete(index)
  }
}

// 离视口远的页释放画布，长文档不会把每页都留在内存里；滚回来再画。
function releasePage(index) {
  const page = pages.value[index]
  if (!page || !page.rendered) return
  const host = hosts[index]
  host?.replaceChildren()
  page.rendered = false
}

function setupObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const index = slots.indexOf(entry.target)
        if (index < 0) continue
        if (entry.isIntersecting) renderPage(index, entry.target)
        else releasePage(index)
      }
    },
    { root: scroller.value, rootMargin: '800px 0px' },
  )
  for (const slot of slots) {
    if (slot) observer.observe(slot)
  }
}

async function load() {
  state.value = 'loading'
  error.value = ''
  renderVersion += 1
  if (doc) {
    try {
      doc.destroy()
    } catch (err) {
      // 旧的 PDF 已经销毁。
    }
    doc = null
  }
  pages.value = []
  slots.length = 0
  hosts.length = 0
  try {
    const response = await fetch(props.url)
    if (!response.ok) {
      let message = `预览失败（${response.status}）`
      try {
        const data = await response.json()
        if (data && data.error) message = data.error
      } catch (err) {
        // 不是 JSON 就用状态码。
      }
      throw new Error(message)
    }
    const buffer = new Uint8Array(await response.arrayBuffer())
    const lib = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = worker.default
    const task = lib.getDocument({ data: buffer })
    doc = await task.promise
    pageCount.value = doc.numPages
    const first = await doc.getPage(1)
    const viewport = first.getViewport({ scale: 1 })
    base = { width: viewport.width, height: viewport.height }
    scale.value = computeFit()
    pages.value = Array.from({ length: doc.numPages }, (_, index) => ({
      num: index + 1,
      width: Math.round(base.width * scale.value),
      height: Math.round(base.height * scale.value),
      rendered: false,
    }))
    state.value = 'ready'
    await nextTick()
    observeScroller()
    setupObserver()
  } catch (err) {
    error.value = err && err.message ? err.message : ''
    state.value = 'error'
  }
}

// 滚动容器在 ready 之后才出现，等它挂上再观察尺寸。
function observeScroller() {
  if (!scroller.value) return
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      if (!fitMode || state.value !== 'ready') return
      const next = computeFit()
      if (Math.abs(next - scale.value) > 0.01) applyScale(next, true)
    })
  }
  resizeObserver.disconnect()
  resizeObserver.observe(scroller.value)
}

onMounted(load)

onBeforeUnmount(() => {
  observer?.disconnect()
  resizeObserver?.disconnect()
  for (const task of renderTasks.values()) {
    try {
      task.cancel()
    } catch (err) {
      // 已结束。
    }
  }
  if (doc) doc.destroy()
})
</script>

<style scoped>
.pdf-pane {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pdf-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.pdf-zoom {
  min-width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pdf-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.pdf-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.pdf-page {
  position: relative;
  flex: 0 0 auto;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}
.pdf-page.done {
  background: none;
  box-shadow: none;
}
.pdf-page canvas {
  display: block;
}
.pdf-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
}
.pdf-wait {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
}
</style>
