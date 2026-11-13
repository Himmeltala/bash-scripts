import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { LogView } from '@bash-scripts/web-shared'
import vuetify from './plugins/vuetify'
// Roboto 只取拉丁字形，中文由公共样式里的系统字体接住。
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
// 代码与日志单独用等宽字体，同样只取拉丁字形。
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@bash-scripts/web-shared/style.css'

// 日志终端在设置对话框、压缩栏都用，注册成全局组件，页面里直接写 <LogView>。
createApp(App).component('LogView', LogView).use(createPinia()).use(vuetify).mount('#app')
