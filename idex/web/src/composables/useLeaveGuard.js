/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:07:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 01:07:00
 * @FilePath: \idex\web\src\composables\useLeaveGuard.js
 * @Description: 有未保存改动时离开前先问一句：取消、丢弃或保存。
 */
import { ref } from 'vue'

export function useLeaveGuard({ isDirty, save, drop }) {
  const asking = ref(false)
  let resolve = null

  // 返回 true 表示可以走，'saved'、'dropped' 表示已经处理完，false 表示留下。
  function confirmLeave() {
    if (!isDirty()) return Promise.resolve(true)
    if (asking.value) return Promise.resolve(false)
    asking.value = true
    return new Promise((done) => {
      resolve = done
    })
  }

  function settle(value) {
    const done = resolve
    resolve = null
    asking.value = false
    if (done) done(value)
  }

  async function answer(kind) {
    if (kind === 'cancel') {
      settle(false)
      return
    }
    if (kind === 'drop') {
      drop()
      settle('dropped')
      return
    }
    settle((await save()) ? 'saved' : false)
  }

  // 组件卸载时把还挂着的询问收掉，别让调用方永远等下去。
  function cancel() {
    if (resolve) settle(false)
  }

  return { asking, confirmLeave, answer, cancel }
}
