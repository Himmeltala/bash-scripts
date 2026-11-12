import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
// Roboto 只取拉丁字形，中文写在 base.css 里由系统字体接住。
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
import './styles/base.css'

createApp(App).use(vuetify).mount('#app')
