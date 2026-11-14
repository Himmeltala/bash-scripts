// 日志着色的骨架：ANSI 常量、paint 与按行套规则的 colorize 工厂。
// 具体规则表（npm、Maven 等）留在各自的工程里，这里只提供匹配与套色的流程。

export const RESET = '\u001b[0m'

export function paint(code, text) {
  return `\u001b[${code}m${text}${RESET}`
}

// 规则可以写成函数，或者：
// { test, color }       test 命中后整行套 color；
// { match, render }     match 的匹配结果交给 render(match, line) 自己拼；
// 也支持 test 与 render 一起用，render 收到的是 test 的返回值。
export function createLogColorizer({ rules = [], skipAnsi = false } = {}) {
  function applyRule(rule, line) {
    if (typeof rule === 'function') return rule(line)
    if (rule.match) {
      const hit = rule.match.exec(line)
      if (!hit) return null
      return rule.render ? rule.render(hit, line) : paint(rule.color, line)
    }
    if (rule.test) {
      const hit = typeof rule.test === 'function' ? rule.test(line) : rule.test.test(line)
      if (!hit) return null
      if (rule.render) return rule.render(hit, line)
      return paint(typeof rule.color === 'function' ? rule.color(line) : rule.color, line)
    }
    return null
  }

  function colorLine(line) {
    if (!line) return line
    // 已经带 ANSI 的行（工具自己上的色）原样放行，不重复套。
    if (skipAnsi && line.includes('\u001b')) return line
    for (const rule of rules) {
      const out = applyRule(rule, line)
      if (out != null) return out
    }
    return line
  }

  return (text) => (text ? text.split('\n').map(colorLine).join('\n') : '')
}
