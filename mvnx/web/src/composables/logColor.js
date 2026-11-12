// 日志着色：按行把 Maven 与 Spring 的级别标记套上 ANSI 颜色，交给终端渲染。
// 只影响页面显示，日志文件本身一个字节都不动。

const RESET = '\u001b[0m'

function paint(code, text) {
  return `\u001b[${code}m${text}${RESET}`
}

const LEVEL_COLOR = {
  TRACE: '90',
  DEBUG: '36',
  INFO: '32',
  WARN: '33',
  ERROR: '31',
  FATAL: '1;31',
}

// logback / Spring Boot：2026-11-12 14:43:07.918  WARN 271871 --- [main] c.Cls : 内容
const LOGGER = /^(\d{4}-\d{2}-\d{2}[ T][\d:.,]+)(\s+)(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/

// Maven：行首的 [INFO] / [WARNING] / [ERROR] / [DEBUG]。
const MAVEN = /^\[(INFO|WARNING|ERROR|DEBUG)\](.*)$/
const MAVEN_COLOR = { INFO: '32', WARNING: '33', ERROR: '31', DEBUG: '36' }

function colorLine(line) {
  if (!line) return line
  const logger = line.match(LOGGER)
  if (logger) {
    const head = logger[0]
    return paint('90', logger[1]) + logger[2] + paint(LEVEL_COLOR[logger[3]], logger[3]) + line.slice(head.length)
  }
  const maven = line.match(MAVEN)
  if (maven) {
    return paint(MAVEN_COLOR[maven[1]], `[${maven[1]}]`) + maven[2]
  }
  if (/^BUILD SUCCESS/.test(line)) return paint('1;32', line)
  if (/^BUILD FAILURE|^BUILD ERROR/.test(line)) return paint('1;31', line)
  if (/^--- /.test(line)) return paint('36', line)
  if (/^(Downloading|Downloaded|Progress) /.test(line)) return paint('90', line)
  if (/^Caused by:/.test(line)) return paint('31', line)
  if (/^\s+at .+\(/.test(line)) return paint('90', line)
  return line
}

export function colorize(text) {
  if (!text) return ''
  return text.split('\n').map(colorLine).join('\n')
}
