// 日志着色：按行把 Maven 与 Spring 的级别标记套上 ANSI 颜色，交给终端渲染。
// 规则表留在这里，套色流程走共享骨架；只影响页面显示，日志文件本身一个字节都不动。

import { createLogColorizer, paint } from '@bash-scripts/web-shared/logs'

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

const RULES = [
  {
    match: LOGGER,
    render(match, line) {
      return (
        paint('90', match[1]) +
        match[2] +
        paint(LEVEL_COLOR[match[3]], match[3]) +
        line.slice(match[0].length)
      )
    },
  },
  {
    match: MAVEN,
    render(match) {
      return paint(MAVEN_COLOR[match[1]], `[${match[1]}]`) + match[2]
    },
  },
  { test: /^BUILD SUCCESS/, color: '1;32' },
  { test: /^BUILD FAILURE|^BUILD ERROR/, color: '1;31' },
  { test: /^--- /, color: '36' },
  { test: /^(Downloading|Downloaded|Progress) /, color: '90' },
  { test: /^Caused by:/, color: '31' },
  { test: /^\s+at .+\(/, color: '90' },
]

export const colorize = createLogColorizer({ rules: RULES })
