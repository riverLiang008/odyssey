import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createEditorRepository, editorRepositoryKey } from './app/editorRepository'
import { router } from './router'
import { isPublicDemo } from './app/appMode'
import './styles/main.css'
import './styles/app-shell.css'

async function mountApplication() {
  const repository = isPublicDemo
    ? (await import('./demo/demoRepository')).createDemoRepository()
    : createEditorRepository()
  createApp(App)
    .provide(editorRepositoryKey, repository)
    .use(createPinia())
    .use(router)
    .mount('#app')
}
void mountApplication()

