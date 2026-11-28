import { languageOf } from '../../../../utils/commons/highlight.js'

// 每种文件类型一个处理器，自己管渲染与编辑：.md 固定源码 + 渲染双栏，
// 代码文件的源码是代码着色编辑，认不出的类型走纯文本。
const HANDLERS = {
  markdown: {
    id: 'markdown',
    // 打开 Markdown 先给双栏；切过其它模式后，同一会话换文件沿用上次选择。
    defaultMode: 'split',
    modes: [
      { id: 'source', title: '源码', icon: 'mdi-code-tags', load: () => import('./markdown/MarkdownEditor.vue') },
      { id: 'render', title: '视图', icon: 'mdi-eye-outline', load: () => import('./markdown/MarkdownView.vue') },
      { id: 'split', title: '双栏', icon: 'mdi-view-column-outline', load: () => import('./markdown/MarkdownSplit.vue') },
    ],
  },
  code: {
    id: 'code',
    modes: [{ id: 'source', title: '源码', load: () => import('./code/CodeEditor.vue') }],
  },
  plain: {
    id: 'plain',
    modes: [{ id: 'source', title: '源码', load: () => import('./plain/PlainEditor.vue') }],
  },
}

// 认不出来的扩展名一律走纯文本。
export function handlerOf(path) {
  const language = languageOf(path)
  if (language === 'markdown') return HANDLERS.markdown
  if (language) return HANDLERS.code
  return HANDLERS.plain
}

export function modesOf(path) {
  return handlerOf(path).modes
}

export function defaultModeOf(path) {
  return handlerOf(path).defaultMode || ''
}

// 代码文件且调用方提供了编辑器插槽时，由插槽接管，内置代码处理器让位。
export function usesEditorSlot(path, hasSlot) {
  return Boolean(hasSlot) && handlerOf(path).id === 'code'
}

export function resolveMode(mode, modes) {
  if (modes.some((item) => item.id === mode)) return mode
  return modes[0] ? modes[0].id : 'source'
}

// 带行号打开（内容搜索命中）要落到那一行：纯渲染视图定位不了，回源码；双栏能定位。
export function viewForOpen(mode, line) {
  return line > 0 && mode === 'render' ? 'source' : mode
}

// 视图组件加载失败：退回源码，并把原因带出去。
export function viewLoadFailure(err) {
  const detail = err && err.message ? `：${err.message}` : ''
  return { mode: 'source', message: `视图加载失败${detail}` }
}
