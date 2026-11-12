// 页面上反复用到的小格式化：状态字母、日志动作、日期与路径。

const STATUS = {
  modified: { letter: 'M', text: '改动', color: 'modified' },
  added: { letter: 'A', text: '新增', color: 'added' },
  deleted: { letter: 'D', text: '删除', color: 'deleted' },
  replaced: { letter: 'R', text: '替换', color: 'primary' },
  renamed: { letter: 'R', text: '重命名', color: 'primary' },
  missing: { letter: '!', text: '缺失', color: 'deleted' },
  conflicted: { letter: 'C', text: '冲突', color: 'deleted' },
  obstructed: { letter: '~', text: '阻挡', color: 'deleted' },
  incomplete: { letter: '!', text: '不完整', color: 'modified' },
  unversioned: { letter: '?', text: '未纳入版本控制', color: 'unversioned' },
  normal: { letter: 'P', text: '属性改动', color: 'primary' },
}

export function statusOf(item) {
  return STATUS[item] || { letter: '?', text: item || '未知', color: 'unversioned' }
}

// 日志里的路径动作：A 新增、M 改动、D 删除、R 替换。
const ACTIONS = {
  A: { text: '新增', color: 'added' },
  M: { text: '改动', color: 'modified' },
  D: { text: '删除', color: 'deleted' },
  R: { text: '替换', color: 'primary' },
}

export function actionOf(action) {
  return ACTIONS[action] || { text: action || '改动', color: 'unversioned' }
}

export function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : full
}

export function dirName(full) {
  const parts = String(full || '').split('/')
  parts.pop()
  return parts.join('/')
}

// 提交时间形如 2026-11-12T09:30:00.000000Z，页面只显示到分钟。
export function when(iso) {
  if (!iso) return ''
  const text = String(iso).replace('T', ' ').replace(/\.\d+/, '').replace('Z', '')
  return text.slice(0, 16)
}

export function firstLine(text) {
  const lines = String(text || '').split('\n')
  return lines.find((line) => line.trim()) || '（没有写提交说明）'
}

export function shortPath(repoPath) {
  return String(repoPath || '').replace(/^\/+/, '')
}

// 列表窄，长路径从中间省略：开头看得到模块，结尾看得到文件名。
export function shortenPath(text, max = 42) {
  const s = String(text || '')
  if (s.length <= max) return s
  const keep = max - 1
  const head = Math.ceil(keep / 3)
  const tail = keep - head
  return s.slice(0, head) + '…' + s.slice(-tail)
}
