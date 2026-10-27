import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
process.chdir(root)
const check=process.argv.includes('--check')
const selection=JSON.parse(await readFile('apps/web/src/demo/data/selection.json','utf8')).journeys
const env=await readFile('.env','utf8').catch(()=> '')
const configured=env.match(/^VITE_API_BASE_URL\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'')
const base=new URL(process.env.ODYSSEY_DEMO_API_BASE_URL??configured??'http://127.0.0.1:8200/api/v1')
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Demo synchronization requires an explicitly local API')
const api=base.href.replace(/\/$/,'')
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const comparable=snapshot=>canonical({...snapshot,capturedAt:undefined})
async function get(route) {
  const response=await fetch(api+route,{signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw new Error(`Local demo read failed (${response.status}): ${route}`)
  return response.json()
}
function audit(value,key='') {
  if(Array.isArray(value)){value.forEach(item=>audit(item,key));return}
  if(value&&typeof value==='object'){for(const [name,item]of Object.entries(value))audit(item,name);return}
  if(typeof value!=='string')return
  if(/X-Amz-Signature=|X-Amz-Credential=|\bsk-[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----/.test(value))throw new Error('Credential material cannot be published in a demo snapshot')
  if(/^(api[_-]?key|secret|access[_-]?token|password)$/i.test(key)&&value.trim()&&!/example|placeholder|your[_ -]|<.*>|\$\{|^demo-/i.test(value))throw new Error('Review credential-like demo content before publishing')
}
const journeys=[],agents=[],spaceIds=new Set()
function references(graph) {
  for(const node of graph.nodes) {
    if(node.type==='agent_action')for(const id of node.config.knowledgeSpaceIds)if(typeof id==='string')spaceIds.add(id)
    if(node.type==='task')for(const step of node.config.steps)if(step.kind==='knowledge_retrieval'&&typeof step.configuration.knowledgeSpaceId==='string')spaceIds.add(step.configuration.knowledgeSpaceId)
    if(node.type==='loop')references(node.config.body.graph)
  }
}
for(const selected of selection) {
  const journey=await get(`/journeys/${selected.id}`)
  if(journey.journey.name!==selected.name)throw new Error(`Selected demo no longer matches ${selected.name}; update selection deliberately`)
  journeys.push(journey)
  for(const summary of journey.agents) {
    const agent=await get(`/journeys/${selected.id}/agents/${summary.id}`)
    references(agent.workflow)
    for(const tool of agent.reusableTools)if(tool.kind==='knowledge_retrieval'&&typeof tool.configuration.knowledgeSpaceId==='string')spaceIds.add(tool.configuration.knowledgeSpaceId)
    agents.push(agent)
  }
}
const knowledgeSpaces=[]
async function checkedLocalDocument(name,checksum) {
  if(!checksum)throw new Error(`Missing storage object and checksum: ${name}`)
  async function search(directory) {
    for(const entry of await readdir(directory,{withFileTypes:true})) {
      const file=path.join(directory,entry.name)
      if(entry.isDirectory()){const found=await search(file);if(found)return found}
      else if(entry.name===name){const bytes=await readFile(file);if(createHash('sha256').update(bytes).digest('hex')===checksum)return bytes}
    }
  }
  const bytes=await search(path.join(root,'doc/product/cases'))
  if(!bytes)throw new Error(`Missing storage object; no checksum-identical local case document: ${name}`)
  console.log(`Storage object missing; using checksum-identical repository document: ${name}`)
  return bytes
}
for(const id of spaceIds) {
  const detail=await get(`/knowledge-spaces/${id}`),tree=await get(`/knowledge-spaces/${id}/file-tree`),graph=await get(`/knowledge-spaces/${id}/graph`),resources=[]
  for(const entry of tree.resources) {
    const resource=await get(`/knowledge-spaces/${id}/resources/${entry.id}`)
    const url=new URL(resource.downloadUrl)
    if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Review non-local document storage before exporting')
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)})
    if(!response.ok&&response.status!==404)throw new Error(`Cannot read document ${entry.name}: HTTP ${response.status}`)
    const bytes=response.ok?Buffer.from(await response.arrayBuffer()):await checkedLocalDocument(entry.name,resource.checksumSha256)
    const checksum=createHash('sha256').update(bytes).digest('hex')
    if(resource.checksumSha256&&resource.checksumSha256!==checksum)throw new Error(`Document checksum mismatch: ${entry.name}`)
    const mime=resource.mimeType??'application/octet-stream'
    const preview=/^text\/|application\/json/.test(mime)?{type:'text',content:bytes.toString('utf8'),truncated:false}:{type:'external'}
    resources.push({detail:{...resource,downloadUrl:`data:${mime};base64,${bytes.toString('base64')}`,downloadExpiresAt:'2099-01-01T00:00:00Z'},preview})
  }
  knowledgeSpaces.push({detail,tree,graph,resources})
}
const snapshot={formatVersion:1,capturedAt:new Date().toISOString(),journeys,agents,knowledgeSpaces,systemTools:await get('/tool-definitions')}
audit(snapshot)
// Detect concurrent local edits instead of creating a mixed-revision export.
for(const journey of journeys)if((await get(`/journeys/${journey.journey.id}`)).journey.revision!==journey.journey.revision)throw new Error('Journey changed during export; retry')
for(const agent of agents)if((await get(`/journeys/${agent.agent.journeyId}/agents/${agent.agent.id}`)).agent.revision!==agent.agent.revision)throw new Error('Agent changed during export; retry')
for(const space of knowledgeSpaces)if((await get(`/knowledge-spaces/${space.detail.id}`)).revision!==space.detail.revision)throw new Error('Knowledge Space changed during export; retry')
const require=createRequire(path.join(root,'apps/web/package.json'))
const {createServer}=await import(pathToFileURL(require.resolve('vite')).href)
const server=await createServer({root:path.join(root,'apps/web'),server:{middlewareMode:true},appType:'custom'})
let parsed
try{const {parseDemoSnapshot}=await server.ssrLoadModule('/src/demo/snapshotSchema.ts');parsed=parseDemoSnapshot(snapshot)}finally{await server.close()}
const file='apps/web/src/demo/data/snapshot.json'
if(check) {
  const current=JSON.parse(await readFile(file,'utf8'))
  if(JSON.stringify(comparable(current))!==JSON.stringify(comparable(parsed)))throw new Error('Published demo data differs from the selected local cases. Run pnpm demo:sync and rebuild.')
} else {
  await writeFile(file+'.tmp',JSON.stringify(parsed,null,2)+'\n')
  await rename(file+'.tmp',file)
}
await mkdir('.odyssey-dev',{recursive:true})
await writeFile('.odyssey-dev/demo-data-verification.json',JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),snapshotSha256:digest(await readFile(file,'utf8')),dataDigest:digest(comparable(parsed)),journeys:journeys.map(({journey})=>({id:journey.id,name:journey.name,revision:journey.revision})),agents:agents.map(({agent,workflow})=>({id:agent.id,name:agent.name,revision:agent.revision,nodes:workflow.nodes.length,edges:workflow.edges.length})),knowledgeSpaces:knowledgeSpaces.map(({detail,tree,graph})=>({id:detail.id,name:detail.name,revision:detail.revision,files:tree.resources.length,relations:graph.edges.length}))},null,2)+'\n')
console.log(`${check?'Verified':'Synchronized'} local demo cases: ${journeys.map(x=>x.journey.name).join(', ')}; ${agents.length} Agents; ${knowledgeSpaces.length} Knowledge Spaces; ${knowledgeSpaces.reduce((n,s)=>n+s.resources.length,0)} documents. No local data was modified.`)
