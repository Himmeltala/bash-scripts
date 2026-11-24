/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\test\useLeaveGuard.test.js
 * @Description: 未保存改动时的离开询问：取消、丢弃、保存。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useLeaveGuard } from '../src/features/changes/composables/useLeaveGuard.js'

function makeGuard({ dirty = false, saveOk = true } = {}) {
  const isDirty = ref(dirty)
  let saved = 0
  let dropped = 0
  const guard = useLeaveGuard({
    isDirty: () => isDirty.value,
    save: async () => {
      saved += 1
      return saveOk
    },
    drop: () => {
      dropped += 1
    },
  })
  return { guard, isDirty, counts: () => ({ saved, dropped }) }
}

test('没有改动直接放行，不弹询问', async () => {
  const { guard } = makeGuard()
  assert.equal(await guard.confirmLeave(), true)
  assert.equal(guard.asking.value, false)
})

test('取消留下，丢弃与保存各自处理完再放行', async () => {
  const { guard, counts } = makeGuard({ dirty: true })
  const first = guard.confirmLeave()
  assert.equal(guard.asking.value, true)
  await guard.answer('cancel')
  assert.equal(await first, false)
  assert.equal(guard.asking.value, false)

  const second = guard.confirmLeave()
  await guard.answer('drop')
  assert.equal(await second, 'dropped')
  assert.deepEqual(counts(), { saved: 0, dropped: 1 })

  const third = guard.confirmLeave()
  await guard.answer('save')
  assert.equal(await third, 'saved')
  assert.deepEqual(counts(), { saved: 1, dropped: 1 })
})

test('保存失败不放行，已经在问时不重复开问', async () => {
  const { guard } = makeGuard({ dirty: true, saveOk: false })
  const pending = guard.confirmLeave()
  assert.equal(await guard.confirmLeave(), false)
  await guard.answer('save')
  assert.equal(await pending, false)
})

test('卸载时把还挂着的询问收掉', async () => {
  const { guard } = makeGuard({ dirty: true })
  const pending = guard.confirmLeave()
  guard.cancel()
  assert.equal(await pending, false)
  assert.equal(guard.asking.value, false)
})
