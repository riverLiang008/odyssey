import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createEditorRepository, editorRepositoryKey } from './app/editorRepository'
import { router } from './router'
import './styles/main.css'
import './styles/app-shell.css'

createApp(App)
  .provide(editorRepositoryKey, createEditorRepository())
  .use(createPinia())
  .use(router)
  .mount('#app')

