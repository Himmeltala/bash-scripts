<template>
  <div class="markdown-view">
    <p v-if="!renderable" class="hint">文件超过 200 KB，先看源码。</p>
    <div v-else class="md-body" v-html="html" @click="onClick" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { renderMarkdown, shouldRenderMarkdown } from '../../../../../utils/commons/markdown.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // 这期只占位，留给以后解析相对路径的图片与链接。
  path: { type: String, default: '' },
})

const renderable = computed(() => shouldRenderMarkdown(props.modelValue))
const html = computed(() => (renderable.value ? renderMarkdown(props.modelValue) : ''))

function onClick(event) {
  const link = event.target instanceof Element ? event.target.closest('a') : null
  if (!link) return
  const href = link.getAttribute('href') || ''
  // 相对链接先不跳，免得把整个页面导航走；外链已经带了 target=_blank。
  if (!/^https?:\/\//i.test(href)) event.preventDefault()
}
</script>

<style scoped>
.markdown-view {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 32px;
}
.hint {
  margin: 0;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.md-body {
  font-size: 0.84rem;
  line-height: 1.65;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
}
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3) {
  margin: 1.2em 0 0.5em;
  line-height: 1.35;
  font-weight: 600;
}
.md-body :deep(h1) {
  font-size: 1.35rem;
  padding-bottom: 0.25em;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.md-body :deep(h2) {
  font-size: 1.15rem;
  padding-bottom: 0.2em;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.md-body :deep(h3) {
  font-size: 1rem;
}
.md-body :deep(p),
.md-body :deep(ul),
.md-body :deep(ol),
.md-body :deep(blockquote),
.md-body :deep(table),
.md-body :deep(pre) {
  margin: 0 0 0.9em;
}
.md-body :deep(ul),
.md-body :deep(ol) {
  padding-left: 1.4em;
}
.md-body :deep(li + li) {
  margin-top: 0.2em;
}
.md-body :deep(blockquote) {
  padding: 0.1em 0 0.1em 0.9em;
  border-left: 3px solid rgba(var(--v-theme-on-surface), 0.25);
  color: rgb(var(--v-theme-on-surface-variant));
}
.md-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  margin: 1.2em 0;
}
.md-body :deep(a) {
  color: rgb(var(--v-theme-primary));
}
.md-body :deep(img) {
  max-width: 100%;
}
.md-body :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  font-family: var(--bash-font-mono);
  font-size: 0.92em;
}
.md-body :deep(pre) {
  overflow-x: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.md-body :deep(pre code) {
  padding: 0;
  background: none;
  font-size: 1em;
}
.md-body :deep(table) {
  border-collapse: collapse;
}
.md-body :deep(th),
.md-body :deep(td) {
  padding: 4px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.md-body :deep(th) {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
/* 代码块着色与 EditorPane 同一套。 */
.md-body :deep(.hljs-comment),
.md-body :deep(.hljs-quote) {
  color: rgb(var(--v-theme-on-surface-variant));
  font-style: italic;
}
.md-body :deep(.hljs-keyword),
.md-body :deep(.hljs-selector-tag),
.md-body :deep(.hljs-built_in),
.md-body :deep(.hljs-type) {
  color: rgb(var(--v-theme-primary));
}
.md-body :deep(.hljs-string),
.md-body :deep(.hljs-regexp),
.md-body :deep(.hljs-addition) {
  color: rgb(var(--v-theme-added));
}
.md-body :deep(.hljs-number),
.md-body :deep(.hljs-literal),
.md-body :deep(.hljs-attr),
.md-body :deep(.hljs-attribute),
.md-body :deep(.hljs-property) {
  color: rgb(var(--v-theme-modified));
}
.md-body :deep(.hljs-title),
.md-body :deep(.hljs-section),
.md-body :deep(.hljs-name) {
  color: rgb(var(--v-theme-primary));
}
.md-body :deep(.hljs-tag),
.md-body :deep(.hljs-meta) {
  color: rgb(var(--v-theme-on-surface-variant));
}
.md-body :deep(.hljs-deletion) {
  color: rgb(var(--v-theme-deleted));
}
</style>
