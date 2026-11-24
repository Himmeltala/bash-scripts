import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { logToServer } from './utils/logs'
// Roboto 只取拉丁字形，中文由公共样式里的系统字体接住。
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
// 代码与日志单独用等宽字体，同样只取拉丁字形。
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@bash-scripts/web-shared/style.css'
import '@bash-scripts/web-shared/tailwind.css'

createApp(App).use(createPinia()).use(vuetify).mount('#app')

// 未捕获的前端异常也写进服务端日志，带上原始堆栈，方便回查只闪一下的错误。
window.addEventListener('error', (event) => {
  logToServer('error', event.message || '页面脚本出错', event.error?.stack || '', 'frontend')
})
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = reason && reason.message ? reason.message : String(reason || '未处理的异步错误')
  logToServer('error', message, reason && reason.stack ? reason.stack : '', 'frontend')
})
