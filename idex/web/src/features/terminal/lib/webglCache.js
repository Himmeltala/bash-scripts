/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 21:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 21:40:00
 * @FilePath: \idex\web\src\features\terminal\lib\webglCache.js
 * @Description: 终端 WebGL 上下文的共享保留队列：所有标签共用一个上限。
 */

// 浏览器能同时给的 WebGL 上下文有限，只留最近看过的几个。
const KEEP = 3
const order = []
const slots = new Map()

// 记成最近可见，返回超出保留数、该释放上下文的槽位。
export function holdWebgl(slot) {
  const at = order.indexOf(slot.key)
  if (at >= 0) order.splice(at, 1)
  order.push(slot.key)
  slots.set(slot.key, slot)
  const dropped = []
  while (order.length > KEEP) {
    const key = order.shift()
    const old = slots.get(key)
    slots.delete(key)
    if (old && old !== slot) dropped.push(old)
  }
  return dropped
}

// 终端关闭或上下文丢失时把槽位从队列里摘掉。
export function dropWebgl(slot) {
  const at = order.indexOf(slot.key)
  if (at >= 0) order.splice(at, 1)
  slots.delete(slot.key)
}
