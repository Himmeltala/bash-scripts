// 提交列表的时间线分列：按列表顺序扫一遍，算出每条提交画在哪一列、连到下面哪几列。
// 不依赖 Vue，单独可测；调用方按返回的坐标画 SVG。

export const LANE_W = 14
export const DOT_Y = 16

/**
 * @param {{revision: string, parents?: string[]}[]} entries 已按 topo 顺序排好的提交
 * @param {string[]} palette 每列的颜色，按列号循环取
 */
export function buildGraph(entries, palette) {
  const colorOf = (lane) => palette[lane % palette.length]
  const xOf = (lane) => 7 + lane * LANE_W
  const rows = new Map()
  // waiting[i] 是第 i 列下一行在等的提交号，'' 表示空列。
  const waiting = []
  let width = 1

  for (const entry of entries) {
    const parents = entry.parents || []
    // 上面有列在等这条提交就是它；多列同时等说明这里是合并点。
    const incoming = []
    waiting.forEach((sha, lane) => {
      if (sha === entry.revision) incoming.push(lane)
    })
    let col = incoming[0]
    if (col === undefined) {
      col = waiting.indexOf('')
      if (col < 0) {
        col = waiting.length
        waiting.push('')
      }
    }
    const above = waiting.slice()
    // 合并进来的其它列到此为止。
    for (const lane of incoming.slice(1)) waiting[lane] = ''
    const outgoing = []
    if (parents.length) {
      waiting[col] = parents[0]
      outgoing.push(col)
    } else {
      // 根提交下面没有线。
      waiting[col] = ''
    }
    // 其余父提交各占一列；没有空列就在右边新开一列。
    for (const sha of parents.slice(1)) {
      let lane = waiting.indexOf('')
      if (lane < 0) {
        lane = waiting.length
        waiting.push('')
      }
      waiting[lane] = sha
      outgoing.push(lane)
    }
    const below = waiting.slice()
    width = Math.max(width, above.length, below.length)

    const segments = []
    const lanes = Math.max(above.length, below.length, col + 1)
    for (let lane = 0; lane < lanes; lane++) {
      if (lane === col) continue
      if (incoming.includes(lane)) {
        // 合并进来的列斜插到本行提交点。
        segments.push({
          key: `in${lane}`,
          x1: xOf(lane),
          y1: 0,
          x2: xOf(col),
          y2: DOT_Y,
          color: colorOf(lane),
        })
      } else if (above[lane] && below[lane]) {
        segments.push({
          key: `v${lane}`,
          x1: xOf(lane),
          y1: 0,
          x2: xOf(lane),
          y2: '100%',
          color: colorOf(lane),
        })
      }
    }
    if (above[col]) {
      // 本列上方就是这条提交，补上到提交点的一段。
      segments.push({
        key: 'top',
        x1: xOf(col),
        y1: 0,
        x2: xOf(col),
        y2: DOT_Y,
        color: colorOf(col),
      })
    }
    for (const lane of outgoing) {
      segments.push({
        key: `p${lane}`,
        x1: xOf(col),
        y1: DOT_Y,
        x2: xOf(lane),
        y2: '100%',
        color: colorOf(lane),
      })
    }
    rows.set(entry.revision, { x: xOf(col), color: colorOf(col), segments })
  }

  return { rows, width: width * LANE_W + 8 }
}
