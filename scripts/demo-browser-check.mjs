import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inventory, sha256 } from './demo-inputs.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root,'apps/web/package.json'))
const { chromium } = require('playwright')
const site = path.join(root,'apps/web/dist-demo'), referenceSite = path.join(root,'apps/web/dist-demo-reference')
const bundleDigest = sha256(JSON.stringify(await inventory(site)))
const referenceBundleDigest = sha256(JSON.stringify(await inventory(referenceSite)))
const data = JSON.parse(await readFile(path.join(root,'.odyssey-dev/demo-reference-data.json'),'utf8'))
const output = path.join(root,'.odyssey-dev/demo-smoke')
await mkdir(output,{recursive:true})
async function serve(directory) {
  const server = http.createServer(async (request,response) => {
    const name = decodeURIComponent(new URL(request.url,'http://static.invalid').pathname)
    const file = path.resolve(directory,`.${name}`)
    if (!file.startsWith(directory+path.sep) && file !== directory) { response.writeHead(403).end(); return }
    try {
      const bytes = await readFile(file)
      response.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)] ?? 'text/html'); response.end(bytes)
    } catch {
      if (path.extname(name)) { response.writeHead(404).end(); return }
      response.setHeader('Content-Type','text/html'); response.end(await readFile(path.join(directory,'index.html')))
    }
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  return {server,origin:`http://127.0.0.1:${server.address().port}`}
}
function fixture(url) {
  const parts = url.pathname.replace('/api/v1','').split('/').filter(Boolean)
  if (parts[0] === 'tool-definitions') return data.systemTools
  if (parts[0] === 'agent-templates') return []
  if (parts[0] === 'knowledge-space-categories') return [...new Map(data.spaces.map(space=>[space.detail.category.id,space.detail.category])).values()]
  if (parts[0] === 'journeys') {
    if (parts.length === 1) return data.journeySummaries
    if (parts.length === 2) return data.journeys.find(document=>document.journey.id===parts[1])
    return data.agents.find(document=>document.agent.journeyId===parts[1]&&document.agent.id===parts[3])
  }
  if (parts[0] === 'knowledge-spaces') {
    if (parts.length === 1) {
      const page=Number(url.searchParams.get('page')??1),pageSize=Number(url.searchParams.get('pageSize')??20)
      return {items:data.spaceSummaries.slice((page-1)*pageSize,page*pageSize),page,pageSize,total:data.spaces.length}
    }
    const space=data.spaces.find(space=>space.detail.id===parts[1]);if(!space)return undefined
    if (parts.length === 2) return space.detail
    if (parts[2] === 'file-tree') return space.tree
    if (parts[2] === 'graph') return space.graph
    return space.resources.find(item=>item.detail.id===parts[3])?.detail
  }
}
const deployed = await serve(site), reference = await serve(referenceSite)
let browser
const errors=[],unexpectedRequests=[],results=[],parity=[]
try {
  browser=await chromium.launch({headless:true,...(process.env.DEMO_CHROME_PATH?{executablePath:process.env.DEMO_CHROME_PATH}:process.platform==='win32'?{channel:'chrome'}:{})})
  async function pageFor(origin,isReference) {
    const context=await browser.newContext({viewport:{width:1440,height:900}})
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url())
      if (isReference && url.hostname==='demo-reference.invalid' && request.method()==='GET') {
        const body=fixture(url)
        if(body!==undefined) {await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});return}
      }
      if (!request.url().startsWith(origin+'/') || request.method()!=='GET' || request.url().includes('/api/')) {
        unexpectedRequests.push({reference:isReference,url:request.url(),method:request.method()});await route.abort();return
      }
      await route.continue()
    })
    const page=await context.newPage();page.setDefaultTimeout(15000)
    page.on('pageerror',error=>errors.push({reference:isReference,message:error.message}))
    page.on('console',message=>{if(message.type()==='error')errors.push({reference:isReference,message:message.text()})})
    return page
  }
  const page=await pageFor(deployed.origin,false), normal=await pageFor(reference.origin,true)
  async function load(p,origin,route,selector) {
    await p.goto(origin+route,{waitUntil:'networkidle'});await p.locator(selector).first().waitFor()
    await p.waitForTimeout(250)
  }
  async function metrics(p,selectors) {
    return p.evaluate(selectors=>selectors.map(selector=>{
      const element=document.querySelector(selector);if(!element)throw Error('Missing shared UI: '+selector)
      const r=element.getBoundingClientRect()
      return {selector,x:r.x,y:r.y,width:r.width,height:r.height}
    }),selectors)
  }
  async function compare(label,route,selectors,width,prepare) {
    console.log(`Compare ${label} at ${width}`)
    await page.setViewportSize({width,height:900});await normal.setViewportSize({width,height:900})
    const readySelector=prepare?selectors[0]:selectors.at(-1)
    await Promise.all([load(page,deployed.origin,route,readySelector),load(normal,reference.origin,route,readySelector)])
    if(prepare){await prepare(page);await prepare(normal);await page.waitForTimeout(200);await normal.waitForTimeout(200)}
    const demoMetrics=await metrics(page,selectors),normalMetrics=await metrics(normal,selectors)
    for(let i=0;i<demoMetrics.length;i++) for(const key of ['x','y','width','height']) assert(Math.abs(demoMetrics[i][key]-normalMetrics[i][key])<=2,`${label} ${width}: ${selectors[i]} ${key} differs: demo ${demoMetrics[i][key]}, normal ${normalMetrics[i][key]}`)
    const filename=`parity-${label}-${width}`
    await page.screenshot({path:path.join(output,filename+'-demo.png')})
    await normal.screenshot({path:path.join(output,filename+'-normal.png')})
    parity.push({label,width,status:'passed',demoMetrics,normalMetrics})
  }
  const first=data.agents[0],journeyRoute=`/journeys/${first.agent.journeyId}`,workflowRoute=`${journeyRoute}/agents/${first.agent.id}`,spaceRoute=`/assets/knowledge-spaces/${data.space.id}`
  const inspectionValues=new Map()
  for(const width of [1440,1024]) {
    await compare('journey-list','/journeys',['.journey-list-page','.journey-list-page__heading','.journey-grid'],width)
    for(const [index,agent] of data.agents.entries()) {
      const j=`/journeys/${agent.agent.journeyId}`,a=`${j}/agents/${agent.agent.id}`
      await compare(`journey-${index}`,j,['.journey-editor-page','.editor-tabs','.journey-library','.journey-canvas-stack','.system-canvas'],width)
      await compare(`workflow-${index}`,a,['.workflow-toolbar','.workflow-node-palette','.workflow-canvas-panel','.workflow-right-panel-host'],width,async p=>{
        if(!await p.locator('.workflow-right-panel-host').isVisible()) await p.getByRole('button',{name:'Tools',exact:true}).click()
        await p.locator('.workflow-right-panel-host').waitFor()
      })
      const task=agent.workflow.nodes.find(node=>node.type==='task'&&node.config.steps.length)
      const action=agent.workflow.nodes.find(node=>node.type==='agent_action'&&node.config.reusableToolIds.length)
      for(const [kind,node] of [['task',task],['toolbox',action]]) {
        if(!node)continue
        await compare('inspect-'+kind+'-'+index,a,['.workflow-toolbar','.workflow-canvas-panel','.system-tool-panel'],width,async p=>{
          await p.getByRole('button',{name:'Configure',exact:true}).click()
          const card=p.locator('.vue-flow__node[data-id="'+node.id+'"]')
          const trigger=kind==='task'?card.locator('.task-tool-step-open').first():card.locator('.tool-chip button[title^="Configure "]').first()
          if(await p.locator('.workflow-right-panel-host').isVisible())await p.getByRole('button',{name:'Tools',exact:true}).click()
          await trigger.click()
          const panel=p.getByRole('complementary',{name:kind==='task'?'System Tool configuration':'Agent reusable Tool configuration'})
          await panel.waitFor()
          const actual=await panel.locator('input,textarea,select').evaluateAll(elements=>elements.map(element=>({tag:element.tagName,value:element.value})))
          const key=agent.agent.id+'-'+kind+'-'+width
          if(p===normal){assert.deepEqual(actual,inspectionValues.get(key))}else{inspectionValues.set(key,actual);assert(await panel.getByRole('button',{name:'Save Tool',exact:true}).isDisabled());assert.equal(await panel.locator('input:enabled,textarea:enabled,select:enabled').count(),0)}
        })
        for(const p of [page,normal]) {
          await p.keyboard.press('Escape')
          assert.equal(await p.locator('.system-tool-panel').count(),0,'Escape must close Tool configuration')
        }
      }
      if(agent.reusableTools.length) {
        await compare('inspect-library-'+index,a,['.workflow-toolbar','.workflow-canvas-panel','.system-tool-panel'],width,async p=>{
          await p.getByRole('button',{name:'Configure',exact:true}).click()
          await p.getByRole('button',{name:'Reusable Tools',exact:true}).click()
          await p.locator('.reusable-tool-actions').first().getByRole('button',{name:'Edit',exact:true}).click()
          await p.getByRole('complementary',{name:'Agent reusable Tool configuration'}).waitFor()
          if(p===page)assert(await p.getByRole('button',{name:'Save Tool',exact:true}).isDisabled())
        })
        for(const p of [page,normal]) {
          await p.getByRole('button',{name:'Close Tool configuration',exact:true}).click()
          assert.equal(await p.locator('.system-tool-panel').count(),0)
        }
      }
    }
    await compare('dsl',workflowRoute,['.workflow-toolbar','.workflow-canvas-panel','.workflow-dsl-panel'],width,async p=>{await p.getByRole('button',{name:'DSL Edit',exact:true}).click();await p.getByRole('textbox',{name:'Workflow DSL source'}).waitFor()})
    await compare('knowledge-list','/assets/knowledge-spaces',['.knowledge-list-page','.knowledge-toolbar','.knowledge-card-grid'],width)
    for(const [index,space] of data.spaces.entries()) {
      const route='/assets/knowledge-spaces/'+space.detail.id
      await compare('knowledge-detail-'+index,route,['.knowledge-detail-page','.knowledge-folder-panel','.knowledge-detail-content'],width)
      await compare('knowledge-document-'+index,route+'/documents/'+space.resources[0].detail.id,['.knowledge-detail-page','.knowledge-folder-panel','.knowledge-document-detail'],width)
    }
  }
  results.push(parity.length+' shared-view layout comparisons passed at 1440/1024 with identical read data')
  await load(page,deployed.origin,'/journeys','.journey-card')
  assert(await page.getByRole('button',{name:'＋ New OdyJourney',exact:true}).isDisabled())
  assert(await page.getByRole('button',{name:/Delete Document Curator/}).isDisabled())
  await page.getByRole('link',{name:/Open Document Curator/}).click()
  await page.locator('.agent-slot__select').first().click();await page.getByLabel('Read-only Workflow Preview').waitFor()
  await page.getByRole('button',{name:'Open canvas',exact:true}).click()
  await page.locator('.workflow-editor-page').waitFor()
  assert(await page.getByRole('button',{name:'Save now',exact:true}).isDisabled())
  assert.equal(await page.locator('.workflow-flow-surface .vue-flow__node.draggable').count(),0)
  assert.equal(await page.locator('.workflow-node-palette button[draggable="true"]').count(),0)
  await page.getByRole('button',{name:'DSL Edit',exact:true}).click()
  const dsl=page.getByRole('textbox',{name:'Workflow DSL source'})
  assert(await dsl.getAttribute('readonly')!==null)
  const source=await dsl.inputValue();await dsl.focus();await page.keyboard.type('cannot edit');assert.equal(await dsl.inputValue(),source)
  await page.getByRole('button',{name:'Enter focus mode'}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('.workflow-editor-page.is-focus-mode').count(),0)
  await page.reload();await page.locator('.workflow-editor-page').waitFor()
  results.push('Original list → Journey → Preview → Workflow, disabled creation/save, readonly DSL, Focus and deep refresh')
  await load(page,deployed.origin,spaceRoute,'.knowledge-graph-canvas')
  assert.equal(await page.locator('.knowledge-graph-canvas .vue-flow__node').count(),data.graph.nodes.length)
  assert.equal(await page.locator('.knowledge-graph-canvas .vue-flow__edge').count(),6)
  assert(await page.getByRole('button',{name:'Import manifest',exact:true}).isDisabled())
  await page.locator('.knowledge-graph-canvas .vue-flow__node').first().click();await page.getByRole('button',{name:'Open document',exact:true}).click()
  await page.getByLabel('Rendered Markdown preview').waitFor();assert(await page.getByRole('button',{name:'Edit',exact:true}).isDisabled())
  assert(await page.getByRole('button',{name:'Delete file',exact:true}).isDisabled())
  await page.reload();await page.getByLabel('Rendered Markdown preview').waitFor()
  results.push('Original knowledge graph → Inspector → document with readonly file operations')
  await page.goto(deployed.origin+'/journeys/new');await page.waitForURL('**/journeys')
  await page.goto(deployed.origin+'/assets/knowledge-spaces/new');await page.waitForURL('**/assets/knowledge-spaces')
  assert.deepEqual(unexpectedRequests,[]);assert.deepEqual(errors,[])
  await writeFile(path.join(output,'results.json'),JSON.stringify({status:'passed',site,bundleDigest,referenceBundleDigest,uiParity:{status:'passed',count:parity.length,tolerancePx:2},results,unexpectedRequests,errors},null,2)+'\n')
  await writeFile(path.join(output,'ui-parity.json'),JSON.stringify(parity,null,2)+'\n')
  console.log(`Static demo passed: ${parity.length} shared-page comparisons and readonly browser checks. Evidence: ${output}`)
} catch(error) {
  await writeFile(path.join(output,'results.json'),JSON.stringify({status:'failed',site,bundleDigest,referenceBundleDigest,parity,results,unexpectedRequests,errors,error:String(error)},null,2)+'\n');throw error
} finally {
  if(browser)await browser.close()
  await Promise.all([deployed.server,reference.server].map(server=>new Promise(resolve=>server.close(resolve))))
}
