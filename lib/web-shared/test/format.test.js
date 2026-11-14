// 纯格式化函数测试：不跑浏览器，只验输出口径。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseName,
  dirName,
  firstLine,
  formatAgo,
  formatBytes,
  formatCompact,
  formatDateTime,
  formatMoney,
  formatNumber,
  shortPath,
  shortenPath,
} from '../src/utils/format.js'

test('路径：最后一段、目录、去掉开头斜杠', () => {
  assert.equal(baseName('/home/me/project/'), 'project')
  assert.equal(baseName(''), '')
  assert.equal(dirName('/home/me/project/file.js'), '/home/me/project')
  assert.equal(dirName('file.js'), '')
  assert.equal(shortPath('///a/b'), 'a/b')
})

test('长路径从中间省略，短路径不动', () => {
  assert.equal(shortenPath('short'), 'short')
  const text = 'aaaaaaaaaa/bbbbbbbbbb/cccccccccc/dddddddddd'
  const cut = shortenPath(text, 20)
  assert.equal(cut.length, 20)
  assert.ok(cut.includes('…'))
  assert.ok(cut.startsWith('aaa'))
  assert.ok(cut.endsWith('dddd'))
})

test('提交说明只取第一行非空内容', () => {
  assert.equal(firstLine('\n\n  fix: 标题\n正文'), '  fix: 标题')
  assert.equal(firstLine(''), '（没有写提交说明）')
})

test('日期按本地时区显示到分钟，坏值截断', () => {
  const date = new Date(2026, 0, 2, 3, 4)
  assert.equal(formatDateTime(date.toISOString()), '2026-01-02 03:04')
  assert.equal(formatDateTime(''), '')
  assert.equal(formatDateTime('not-a-date'), 'not-a-date')
})

test('相对时间按秒级时间戳换算', () => {
  const now = 1_700_000_000_000
  const base = now / 1000
  assert.equal(formatAgo(0, now), '')
  assert.equal(formatAgo(base - 30, now), '30 秒前')
  assert.equal(formatAgo(base - 90, now), '1 分钟前')
  assert.equal(formatAgo(base - 3900, now), '1 小时前')
  assert.equal(formatAgo(base - 90000, now), '1 天前')
  assert.equal(formatAgo(base + 10, now), '0 秒前')
})

test('文件大小默认字节、KB、MB 与现有显示一致', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(1024 * 1024), '1.00 MB')
  assert.equal(formatBytes(), '0 B')
})

test('文件大小的单位与精度可配', () => {
  assert.equal(
    formatBytes(1536, { units: ['B', 'KiB'], precision: [0, 2], base: 1024 }),
    '1.50 KiB',
  )
})

test('数字、金额与大数缩写保持 tokx 口径', () => {
  assert.equal(formatNumber(1234.6), '1,235')
  assert.equal(formatNumber('x'), '0')
  assert.equal(formatMoney(null), '--')
  assert.equal(formatMoney(12.5), '12.50')
  assert.equal(formatCompact(999), '999')
  assert.equal(formatCompact(1500), '1.5K')
  assert.equal(formatCompact(2_500_000), '2.50M')
  assert.equal(formatCompact(1_000_000_000), '1.00B')
})
