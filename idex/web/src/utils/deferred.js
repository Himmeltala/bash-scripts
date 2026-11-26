/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\src\utils\deferred.js
 * @Description: 变更页默认不渲染的路径判断，覆盖锁文件与构建产物。
 */
// 变更页默认不取差异的路径：锁文件与构建产物，体量大、看差异也用不上。
// 规则按路径段匹配：* 只配一段里的任意字符，** 配任意多段。
export const DEFERRED_PATTERNS = [
  // 依赖锁文件
  '**/*.lock',
  '**/package-lock.json',
  '**/npm-shrinkwrap.json',
  '**/pnpm-lock.yaml',
  '**/bun.lockb',
  '**/go.sum',
  '**/packages.lock.json',
  // 构建与依赖目录
  '**/dist/**',
  '**/build/**',
  '**/target/**',
  '**/out/**',
  '**/obj/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/Pods/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/.svelte-kit/**',
  '**/.parcel-cache/**',
  '**/.turbo/**',
]

const SEGMENTS = new Map()

function segmentMatches(pattern, segment) {
  let rule = SEGMENTS.get(pattern)
  if (!rule) {
    const source = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
    rule = new RegExp(`^${source}$`)
    SEGMENTS.set(pattern, rule)
  }
  return rule.test(segment)
}

function matchesParts(pattern, parts) {
  if (!pattern.length) return !parts.length
  const [head, ...rest] = pattern
  if (head === '**') {
    // ** 可以不吃任何一段，也可以往后挪一段再试。
    return matchesParts(rest, parts) || (parts.length > 0 && matchesParts(pattern, parts.slice(1)))
  }
  if (!parts.length) return false
  return segmentMatches(head, parts[0]) && matchesParts(rest, parts.slice(1))
}

export function isDeferred(path) {
  const clean = String(path || '').replace(/^\/+/, '')
  if (!clean) return false
  const parts = clean.split('/')
  return DEFERRED_PATTERNS.some((pattern) => matchesParts(pattern.split('/'), parts))
}
