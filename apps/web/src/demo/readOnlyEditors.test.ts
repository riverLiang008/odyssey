import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDemoRepository } from './demoRepository'
import { demoAgents, demoJourneys, demoKnowledgeSnapshots } from './demoData'
import { useWorkflowEditorStore } from '@/stores/workflowEditor'
import { useJourneyEditorStore } from '@/stores/journeyEditor'
import { cryptoPatternIdFactory } from '@/domain/pattern'

describe('Shared editors with a read-only repository', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it.each(demoAgents)('allows viewing $agent.name but rejects layout, graph and save mutations', async agent => {
    const repository = createDemoRepository(), save = vi.spyOn(repository,'saveAgentWorkflow')
    const store = useWorkflowEditorStore()
    await store.load(agent.agent.journeyId,agent.agent.id,repository)
    const before = store.toSaveInput()
    store.setMode('configure')
    const node = agent.workflow.nodes.find(node=>node.type !== 'start' && node.type !== 'end')
    if (!node) throw new Error('Missing inspectable node')
    store.selectNode(node.id)
    store.setViewport({ x:500,y:600,zoom:1.5 })
    store.moveWorkflowNode(node.id,{ x:900,y:1000 })
    store.renameWorkflowNode({kind:'root'},node.id,'Should not change')
    store.removeWorkflowNodeWithLayout(node.id)
    store.resizeWorkflowNode(node.id,{width:800,height:600})
    const variable=agent.variables[0]
    if(variable) store.saveAgentVariable({...variable,displayName:'Should not change'})
    expect(await store.save()).toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(store.toSaveInput()).toEqual(before)
    expect(store.hasUnsavedChanges).toBe(false)
    expect(store.session.selectedNodeId).toBe(node.id)
    store.dispose()
  })
  it('preserves Journey tabs/preview and blocks pattern or server writes', async () => {
    const repository=createDemoRepository(),save=vi.spyOn(repository,'saveJourney')
    const store=useJourneyEditorStore(),journey=demoJourneys[0]
    if(!journey) throw new Error('Missing Journey')
    await store.load(journey.journey.id,'execution',repository)
    const before=store.toSaveInput(),slot=journey.pattern.slots[0]
    if(!slot)throw new Error('Missing Slot')
    expect(await store.selectSlotForPreview(slot.id,repository)).toBe(true)
    store.addSlot('Cannot add',cryptoPatternIdFactory)
    store.unassignAgent(slot.id)
    expect(await store.save()).toBe(false)
    expect(store.toSaveInput()).toEqual(before)
    expect(store.previewState.type).toBe('ready')
    expect(save).not.toHaveBeenCalled()
    store.dispose()
  })
  it.each(demoKnowledgeSnapshots)('serves $detail.name with its original knowledge contracts', async space => {
    const repository=createDemoRepository()
    const tree=await repository.loadKnowledgeFileTree(space.detail.id)
    const graph=await repository.loadKnowledgeGraph(space.detail.id)
    expect(tree).toEqual({ok:true,value:space.tree})
    expect(graph).toEqual({ok:true,value:space.graph})
    if(!tree.ok||!tree.value.resources[0])throw new Error('Missing resource')
    const document=await repository.loadKnowledgeResource(space.detail.id,tree.value.resources[0].id)
    expect(document.ok&&document.value.preview.type).toBe('text')
    expect((await repository.listSystemToolDefinitions()).ok).toBe(true)
  })
})
