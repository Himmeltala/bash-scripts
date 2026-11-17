/*
 * @Author: Himmeltala
 * @Date: 2026-11-17 00:15:49
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-17 23:30:14
 * @FilePath: \lib\web-shared\src\composables\commons\useToast.js
 * @Description: 页面级提示条的状态，toast 打开、close 关闭，由 ToastHost 渲染。
 */
import { reactive } from 'vue'

export function useToast(defaultColor = 'grey') {
  const snack = reactive({ on: false, text: '', color: defaultColor })

  function toast(text, color = defaultColor) {
    snack.text = text
    snack.color = color
    snack.on = true
  }

  function close() {
    snack.on = false
  }

  return { snack, toast, close }
}
