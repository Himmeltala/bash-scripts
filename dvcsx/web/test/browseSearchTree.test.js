/*
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:19:43
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 23:19:43
 * @FilePath: \dvcsx\web\test\browseSearchTree.test.js
 * @Description: 搜索结果按目录归树的归组、排序与收起。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSearchTree, flattenSearchTree } from '../src/utils/browseSearchTree.js'

const nameHit = (path, size = 1) => ({ path, name: path.split('/').pop(), size })

test('空结果是一棵空树', () => {
  assert.deepEqual(buildSearchTree([]), [])
  assert.deepEqual(buildSearchTree(null), [])
})

test('按目录逐层归组，同层目录排在文件前', () => {
  const tree = buildSearchTree([
    nameHit('src/app.js'),
    nameHit('z.txt'),
    nameHit('src/web/view.js'),
    nameHit('README.md'),
  ])
  assert.deepEqual(
    tree.map((node) => `${node.type}:${node.name}`),
    ['dir:src', 'file:README.md', 'file:z.txt']
  )
  assert.deepEqual(
    tree[0].children.map((node) => `${node.type}:${node.name}`),
    ['dir:web', 'file:app.js']
  )
  assert.equal(tree[0].children[0].path, 'src/web')
  assert.equal(tree[0].children[1].hits.length, 0)
})

test('同一个文件的多处内容命中并到一处，行号按命中顺序留着', () => {
  const tree = buildSearchTree([
    { path: 'src/app.js', name: 'app.js', size: 9, line: 3, text: 'hit' },
    { path: 'src/app.js', name: 'app.js', size: 9, line: 8, text: 'hit again' },
  ])
  const file = tree[0].children[0]
  assert.equal(file.type, 'file')
  assert.deepEqual(file.hits, [
    { line: 3, text: 'hit' },
    { line: 8, text: 'hit again' },
  ])
})

test('摊平带上层级，收起的目录不铺孩子', () => {
  const tree = buildSearchTree([nameHit('a/b/c.txt'), nameHit('a/d.txt')])
  const rows = flattenSearchTree(tree, new Set())
  assert.deepEqual(
    rows.map((row) => `${row.depth}:${row.type}:${row.path}`),
    ['0:dir:a', '1:dir:a/b', '2:file:a/b/c.txt', '1:file:a/d.txt']
  )
  const folded = flattenSearchTree(tree, new Set(['a', 'a/b']))
  assert.deepEqual(
    folded.map((row) => `${row.depth}:${row.type}:${row.path}`),
    ['0:dir:a']
  )
})
