// 日志着色：按行把 Node 工具与常见日志的级别标记套上 ANSI 颜色，交给终端渲染。
// 规则表留在这里，套色流程走共享骨架；只影响页面显示，日志文件本身一个字节都不动。

import { createLogColorizer, paint } from '@bash-scripts/web-shared/logs'

const LEVEL_COLOR = {
  TRACE: '90',
  DEBUG: '36',
  INFO: '32',
  LOG: '32',
  WARN: '33',
  WARNING: '33',
  ERROR: '31',
  FATAL: '1;31',
}

// 2026-11-12 14:43:07.918  INFO ... 或 [2026-11-12 14:43:07] WARN ...
const LOGGER = /^(\[?\d{4}-\d{2}-\d{2}[ T][\d:.,]+Z?\]?)(\s+)(TRACE|DEBUG|INFO|LOG|WARN|WARNING|ERROR|FATAL)\b/i

// npm 的各级前缀：npm ERR! / npm error / npm WARN / npm warn / npm notice。
const NPM = /^(npm )(ERR!|error|WARN|warn|notice)(.*)$/
const NPM_COLOR = { 'ERR!': '31', error: '31', WARN: '33', warn: '33', notice: '36' }

const RULES = [
  {
    match: LOGGER,
    render(match, line) {
      const level = match[3].toUpperCase()
      return (
        paint('90', match[1]) +
        match[2] +
        paint(LEVEL_COLOR[level] || '0', match[3]) +
        line.slice(match[0].length)
      )
    },
  },
  {
    match: NPM,
    render(match) {
      return match[1] + paint(NPM_COLOR[match[2]], match[2]) + match[3]
    },
  },
  { test: /^DEPRECATION WARNING/, color: '33' },
  {
    match: /^(WARN|WARNING|ERROR)[: ]/,
    render(match, line) {
      return paint(match[1] === 'ERROR' ? '31' : '33', line)
    },
  },
  { test: /^[A-Za-z_$][\w$]*Error(:| \[)/, color: '31' },
  { test: /^\s+at .+:\d+:\d+\)?$/, color: '90' },
  { test: /^\[nodemon\]/, color: '36' },
  { test: /^(\s*)(➜\s*)?(Local|Network):/, color: '36' },
]

export const colorize = createLogColorizer({ skipAnsi: true, rules: RULES })
