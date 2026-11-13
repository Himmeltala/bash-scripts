import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
// Roboto 只取拉丁字形，中文由公共样式里的系统字体接住。
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
// 代码与等宽数字用 JetBrains Mono，同样只取拉丁字形。
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@bash-scripts/web-shared/style.css'

createApp(App).use(vuetify).mount('#app')
