import { languageOf } from '../../../../utils/commons/highlight.js'

// 每种文件类型一个处理器，自己管渲染与编辑：.md 的源码是 markdown 编辑，
// 代码文件的源码是代码着色编辑，认不出的类型走纯文本。
const HANDLERS = {
  markdown: {
    id: 'markdown',
    modes: [
      { id: 'source', title: '源码', load: () => import('./markdown/MarkdownEditor.vue') },
      { id: 'render', title: '渲染', load: () => import('./markdown/MarkdownView.vue') },
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
export function handlerOf(path, codeView = null) {
  const language = languageOf(path)
  if (language === 'markdown') return HANDLERS.markdown
  if (language) return codeView || HANDLERS.code
  return HANDLERS.plain
}

export function modesOf(path, codeView = null) {
  return handlerOf(path, codeView).modes
}

// 当前文件是否由调用方给的自定义代码视图接管；模板按它决定要不要透传 viewProps。
export function usesCodeView(path, codeView = null) {
  return Boolean(codeView) && handlerOf(path, codeView) === codeView
}

export function resolveMode(mode, modes) {
  return modes.some((item) => item.id === mode) ? mode : 'source'
}

// 带行号打开（内容搜索命中）要落到那一行：渲染视图定位不了，回源码。
export function viewForOpen(mode, line) {
  return line > 0 ? 'source' : mode
}

// 视图组件加载失败：退回源码，并把原因带出去。
export function viewLoadFailure(err) {
  const detail = err && err.message ? `：${err.message}` : ''
  return { mode: 'source', message: `视图加载失败${detail}` }
}
