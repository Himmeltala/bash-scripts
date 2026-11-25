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

const app = createApp(App)

// 全局错误先挂监听再挂载：首屏渲染期间出的错也要收进服务端日志。
// 资源加载失败只有捕获阶段拿得到，顺便标出是哪个标签、哪个地址。
function resourceError(target) {
  if (!(target instanceof Element)) return ''
  if (target instanceof HTMLScriptElement) return `脚本加载失败：${target.src}`
  if (target instanceof HTMLLinkElement) return `样式加载失败：${target.href}`
  if (target instanceof HTMLImageElement) return `图片加载失败：${target.src}`
  return ''
}

window.addEventListener(
  'error',
  (event) => {
    const message = resourceError(event.target)
    if (message) {
      logToServer('error', message, event.target.outerHTML.slice(0, 500), 'frontend')
      return
    }
    logToServer('error', event.message || '页面脚本出错', event.error?.stack || '', 'frontend')
  },
  true,
)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = reason && reason.message ? reason.message : String(reason || '未处理的异步错误')
  logToServer('error', message, reason && reason.stack ? reason.stack : '', 'frontend')
})
// Vue 自己接住的组件错误不会再抛到 window，单独记一条，组件与阶段也带上。
app.config.errorHandler = (err, instance, info) => {
  const message = err && err.message ? err.message : String(err || '组件渲染出错')
  const stack = err && err.stack ? err.stack : ''
  logToServer('error', message, `${info || ''}\n${stack}`.trim(), 'frontend')
  console.error(err)
}

app.use(createPinia()).use(vuetify).mount('#app')
