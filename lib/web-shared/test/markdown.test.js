import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown, shouldRenderMarkdown } from '../src/utils/commons/markdown.js'
import { MAX_HIGHLIGHT } from '../src/utils/commons/highlight.js'

test('原始 HTML 一律转义', () => {
  const html = renderMarkdown('<script>alert(1)</script>')
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
})

test('表格与围栏代码块', () => {
  const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')
  assert.ok(html.includes('<table>'))
  const code = renderMarkdown('```js\nconst a = 1\n```')
  assert.ok(code.includes('<pre class="hljs">'))
  assert.ok(code.includes('hljs-keyword'))
})

test('不认识的代码块语言只转义，不抛错', () => {
  const html = renderMarkdown('```no-such-lang\n<a>\n```')
  assert.ok(html.includes('&lt;a&gt;'))
})

test('外链新开窗口，相对链接不加 target', () => {
  const out = renderMarkdown('[x](https://example.com) [y](./a.md)')
  assert.ok(out.includes('target="_blank"'))
  assert.equal((out.match(/target="_blank"/g) || []).length, 1)
})

test('空内容渲染成空串，超过上限不渲染', () => {
  assert.equal(renderMarkdown(''), '')
  assert.equal(shouldRenderMarkdown('x'.repeat(MAX_HIGHLIGHT)), true)
  assert.equal(shouldRenderMarkdown('x'.repeat(MAX_HIGHLIGHT + 1)), false)
})
