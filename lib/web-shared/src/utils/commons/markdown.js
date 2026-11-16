// Markdown 渲染：原始 HTML 一律转义；代码块交给 highlight.js，与源码视图同一套着色。
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import { MAX_HIGHLIGHT, highlightCode } from './highlight.js'

const LANG_ALIASES = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  html: 'xml',
  htm: 'xml',
  vue: 'xml',
  md: 'markdown',
  py: 'python',
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, lang) {
    const name = LANG_ALIASES[String(lang || '').toLowerCase()] || String(lang || '').toLowerCase()
    // 没注册的语言直接按纯文本转义，别让 highlight.js 先打一条找不到语言的警告。
    return `<pre class="hljs"><code>${highlightCode(code, hljs.getLanguage(name) ? name : '')}</code></pre>`
  },
})

const defaultLink =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || ''
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
  }
  return defaultLink(tokens, idx, options, env, self)
}

export function shouldRenderMarkdown(text) {
  return String(text || '').length <= MAX_HIGHLIGHT
}

export function renderMarkdown(text) {
  if (!text) return ''
  return md.render(text)
}
