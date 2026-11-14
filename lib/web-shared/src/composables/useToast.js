// 页面级提示条的状态：toast(text, color) 打开，ToastHost 负责画。
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
