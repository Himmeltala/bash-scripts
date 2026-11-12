// 日志着色：按行把 Node 工具与常见日志的级别标记套上 ANSI 颜色，交给终端渲染。
// 已经带 ANSI 的行（Vite、Sass、npm 自己上的色）原样放行，不重复套。
// 只影响页面显示，日志文件本身一个字节都不动。

const RESET = '\u001b[0m'

function paint(code, text) {
  return `\u001b[${code}m${text}${RESET}`
}

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

function colorLine(line) {
  if (!line) return line
  if (line.includes('\u001b')) return line
  const logger = line.match(LOGGER)
  if (logger) {
    const head = logger[0]
    const level = logger[3].toUpperCase()
    return paint('90', logger[1]) + logger[2] + paint(LEVEL_COLOR[level] || '0', logger[3]) + line.slice(head.length)
  }
  const npm = line.match(NPM)
  if (npm) return npm[1] + paint(NPM_COLOR[npm[2]], npm[2]) + npm[3]
  if (/^DEPRECATION WARNING/.test(line)) return paint('33', line)
  const loud = line.match(/^(WARN|WARNING|ERROR)[: ]/)
  if (loud) return paint(loud[1] === 'ERROR' ? '31' : '33', line)
  if (/^[A-Za-z_$][\w$]*Error(:| \[)/.test(line)) return paint('31', line)
  if (/^\s+at .+:\d+:\d+\)?$/.test(line)) return paint('90', line)
  if (/^\[nodemon\]/.test(line)) return paint('36', line)
  if (/^(\s*)(➜\s*)?(Local|Network):/.test(line)) return paint('36', line)
  return line
}

export function colorize(text) {
  if (!text) return ''
  return text.split('\n').map(colorLine).join('\n')
}
