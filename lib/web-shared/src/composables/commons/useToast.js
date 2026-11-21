/*
 * @Author: Himmeltala
 * @Date: 2026-11-17 00:15:49
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-17 23:30:14
 * @FilePath: \lib\web-shared\src\composables\commons\useToast.js
 * @Description: 页面级提示条的状态，toast 打开、close 关闭，由 ToastHost 渲染。
 */
import { reactive } from 'vue'

// 整个页面共用一条提示：任何组件调 useToast() 都写同一份状态，由页面里的 ToastHost 渲染。
const snack = reactive({ on: false, text: '', color: 'grey' })

function show(text, color) {
  snack.text = text
  snack.color = color
  snack.on = true
}

function close() {
  snack.on = false
}

export function useToast(defaultColor = 'grey') {
  function toast(text, color = defaultColor) {
    show(text, color)
  }
  return { snack, toast, close }
}
