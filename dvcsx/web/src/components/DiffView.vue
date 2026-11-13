<template>
  <div class="diff">
    <div v-if="title" class="head">
      <div class="headline">
        <span class="title mono" :title="title">{{ title }}</span>
        <v-chip v-if="kind === 'file'" size="x-small" variant="flat" color="unversioned">
          未纳入版本控制，显示文件内容
        </v-chip>
        <v-chip v-if="truncated" size="x-small" variant="flat" color="modified">已截断</v-chip>
      </div>
      <slot name="actions" />
    </div>

    <p v-if="loading" class="hint">正在取差异…</p>
    <p v-else-if="error" class="hint bad">{{ error }}</p>
    <div v-else-if="!rows.length" class="hint">这里没有可显示的内容。</div>
    <div v-else class="body mono">
      <div v-for="(row, i) in rows" :key="i" class="row" :class="row.type">
        <template v-if="row.type === 'meta' || row.type === 'hunk'">
          <span class="wide">{{ row.text }}</span>
        </template>
        <template v-else>
          <span class="ln">{{ row.old }}</span>
          <span class="ln">{{ row.new }}</span>
          <span class="sign">{{ row.sign }}</span>
          <span class="text" v-html="row.html" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { MAX_HIGHLIGHT, highlightCode, languageOf } from '@bash-scripts/web-shared/highlight'

const props = defineProps({
  text: { type: String, default: '' },
  kind: { type: String, default: 'diff' },
  title: { type: String, default: '' },
  path: { type: String, default: '' },
  truncated: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

// 把差异文本拆成带行号的行：左列是旧文件行号，右列是新文件行号。
const rows = computed(() => {
  const text = props.text || ''
  if (!text) return []
  const lines = text.split('\n')
  // 行多或整体太大时不做语法着色，逐行解析的开销不值当。
  const language =
    lines.length <= 2000 && text.length <= MAX_HIGHLIGHT ? languageOf(props.path) : ''
  const code = (row) => ({ ...row, html: highlightCode(row.text, language) })
  const out = []
  let oldNo = 0
  let newNo = 0

  if (props.kind === 'file') {
    return lines.map((line, i) =>
      code({ type: 'add', sign: '+', old: '', new: i + 1, text: line }),
    )
  }

  for (const line of lines) {
    if (line.startsWith('Index: ') || line.startsWith('====') || line.startsWith('\\ ')) {
      out.push({ type: 'meta', text: line })
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++')) {
      out.push({ type: 'meta', text: line })
      continue
    }
    if (line.startsWith('@@')) {
      const hit = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (hit) {
        oldNo = Number(hit[1])
        newNo = Number(hit[2])
      }
      out.push({ type: 'hunk', text: line })
      continue
    }
    if (line.startsWith('+')) {
      out.push(code({ type: 'add', sign: '+', old: '', new: newNo++, text: line.slice(1) }))
      continue
    }
    if (line.startsWith('-')) {
      out.push(code({ type: 'del', sign: '-', old: oldNo++, new: '', text: line.slice(1) }))
      continue
    }
    if (line.startsWith(' ')) {
      out.push(code({ type: 'ctx', sign: '', old: oldNo++, new: newNo++, text: line.slice(1) }))
      continue
    }
    out.push({ type: 'meta', text: line })
  }
  return out
})
</script>

<style scoped>
.diff {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.headline {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.title {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.headline :deep(.v-chip) {
  flex: 0 0 auto;
}
.hint {
  margin: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  font-size: 0.78rem;
  line-height: 1.55;
  padding-bottom: 24px;
}
.row {
  display: flex;
  align-items: flex-start;
  white-space: pre;
  min-height: 1.55em;
}
.row.add {
  background: rgba(46, 160, 67, 0.14);
}
.row.del {
  background: rgba(248, 81, 73, 0.14);
}
.row.hunk {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
  padding: 2px 12px;
}
.row.meta {
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 1px 12px;
}
.ln {
  flex: 0 0 44px;
  text-align: right;
  padding-right: 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  user-select: none;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.sign {
  flex: 0 0 16px;
  text-align: center;
  user-select: none;
}
.row.add .sign {
  color: rgb(var(--v-theme-added));
}
.row.del .sign {
  color: rgb(var(--v-theme-deleted));
}
.text {
  flex: 1 1 auto;
  padding-right: 16px;
}
/* 差异里的代码按浏览目录同一套颜色着色。 */
.text :deep(.hljs-comment),
.text :deep(.hljs-quote) {
  color: rgb(var(--v-theme-on-surface-variant));
  font-style: italic;
}
.text :deep(.hljs-keyword),
.text :deep(.hljs-selector-tag),
.text :deep(.hljs-built_in),
.text :deep(.hljs-type) {
  color: rgb(var(--v-theme-primary));
}
.text :deep(.hljs-string),
.text :deep(.hljs-regexp),
.text :deep(.hljs-addition) {
  color: rgb(var(--v-theme-added));
}
.text :deep(.hljs-number),
.text :deep(.hljs-literal),
.text :deep(.hljs-attr),
.text :deep(.hljs-attribute),
.text :deep(.hljs-property) {
  color: rgb(var(--v-theme-modified));
}
.text :deep(.hljs-title),
.text :deep(.hljs-section),
.text :deep(.hljs-name) {
  color: rgb(var(--v-theme-primary));
}
.text :deep(.hljs-tag),
.text :deep(.hljs-meta) {
  color: rgb(var(--v-theme-on-surface-variant));
}
.text :deep(.hljs-deletion) {
  color: rgb(var(--v-theme-deleted));
}
.wide {
  padding: 0 4px;
}
</style>
