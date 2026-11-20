// 页面上反复用到的小格式化：路径与时间走共享的 /format，这里只留状态与动作词汇。

import { formatDateTime } from '@bash-scripts/web-shared/format'

export {
  baseName,
  dirName,
  firstLine,
  shortPath,
  shortenPath,
} from '@bash-scripts/web-shared/format'

// SVN 给 UTC（带 Z），Git 给带偏移的时间；按浏览器时区显示到分钟。
export const when = formatDateTime

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
