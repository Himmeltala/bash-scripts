import test from 'node:test'
import assert from 'node:assert/strict'
import { diffMarks, hunkOriginal, parseDiffHunks } from '../src/features/editor/core/diffLines.js'

const DIFF = [
  'diff --git a/a.txt b/a.txt',
  '--- a/a.txt',
  '+++ b/a.txt',
  '@@ -1,3 +1,3 @@ title',
  ' same',
  '-old',
  '+new',
  ' tail',
  '@@ -9,2 +9,3 @@',
  ' nine',
  '+ten',
  ' eleven',
  '@@ -20,2 +21,1 @@',
  ' gone',
  '-removed',
  '',
].join('\n')

test('按 @@ 拆块并保留原文', () => {
  const hunks = parseDiffHunks(DIFF)
  assert.equal(hunks.length, 3)
  assert.equal(hunks[0].newStart, 1)
  assert.equal(hunks[0].newLines, 3)
  assert.equal(hunks[0].text, '@@ -1,3 +1,3 @@ title\n same\n-old\n+new\n tail')
  assert.equal(hunks[2].oldStart, 20)
})

test('新增、修改、删除分别落在新文件行号上', () => {
  const marks = diffMarks(parseDiffHunks(DIFF))
  assert.deepEqual(marks[2], { kind: 'modify', hunk: 0 })
  assert.deepEqual(marks[10], { kind: 'add', hunk: 1 })
  assert.deepEqual(marks[21], { kind: 'delete', hunk: 2 })
  assert.equal(marks[1], undefined)
})

test('原文去掉加号行', () => {
  const hunk = parseDiffHunks(DIFF)[0]
  assert.equal(hunkOriginal(hunk), 'same\nold\ntail')
  assert.equal(hunkOriginal(null), '')
})
