/** Development-only browser harness; production builds use index.html, never this entry. */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { editorRepositoryKey } from '../src/app/editorRepository'
import { createAppRouter } from '../src/router'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '../src/fixtures'
import { InMemoryEditorRepository } from '../src/repositories'
import { reconcileWorkflowEnds } from '../src/domain/workflow/workflowEndRouting'
import { cryptoWorkflowIdFactory } from '../src/domain/workflow'
import '../src/styles/main.css'
import '../src/styles/app-shell.css'

const document = createAgentWorkflowEditorDocumentFixture('research')
document.reusableTools = []
for (const node of document.workflow.nodes) if (node.type === 'agent_action') { node.config.knowledgeSpaceIds = []; node.config.reusableToolIds = [] }
const journey = createJourneyEditorDocumentFixture()
const slot = journey.pattern.slots.find((slot) => slot.agentId === document.agent.id)
if (!slot) throw new Error('Acceptance fixture requires an assigned Agent')
const synchronized = reconcileWorkflowEnds(document.workflow, document.layout, journey.pattern, slot.id, cryptoWorkflowIdFactory)
document.workflow = synchronized.graph
document.layout = synchronized.layout
const repository = new InMemoryEditorRepository({ journeys: [journey], agentWorkflows: [document] })
const router = createAppRouter(createMemoryHistory())
await router.push(`/journeys/${document.agent.journeyId}/agents/${document.agent.id}`)
await router.isReady()
createApp(App).provide(editorRepositoryKey, repository).use(createPinia()).use(router).mount('#app')
