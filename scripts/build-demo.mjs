import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inventory, sha256, sourceInputs } from './demo-inputs.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
process.chdir(root)
const before = await sourceInputs(root)
const routes = await readFile('apps/web/src/router/index.ts','utf8')
if (routes.includes("@/demo/") || routes.includes('demoView')) throw new Error('Demo must use the same page components as the normal app')
if (!process.env.npm_execpath) throw new Error('Run this build through pnpm demo:build')
execFileSync(process.execPath,[process.env.npm_execpath,'--filter','@odyssey/web','build:demo'],{stdio:'inherit'})
// The comparison build uses the ordinary HTTP adapter and the same page routes.
// Browser tests intercept only this reserved hostname with the exact demo dataset.
execFileSync(process.execPath,[process.env.npm_execpath,'--filter','@odyssey/web','exec','vite','build','--mode','demo-reference','--outDir','dist-demo-reference'],{stdio:'inherit',env:{...process.env,VITE_API_BASE_URL:'https://demo-reference.invalid/api/v1'}})
const require = createRequire(path.join(root,'apps/web/package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const server = await createServer({root:path.join(root,'apps/web'),server:{middlewareMode:true},appType:'custom'})
try {
  const data = await server.ssrLoadModule('/src/demo/demoData.ts')
  await mkdir('.odyssey-dev',{recursive:true})
  await writeFile('.odyssey-dev/demo-reference-data.json',JSON.stringify({journeys:data.demoJourneys,journeySummaries:data.demoJourneySummaries,agents:data.demoAgents,space:data.demoKnowledgeSpace,spaceSummary:data.demoKnowledgeSummary,tree:data.demoFileTree,graph:data.demoGraph,resources:data.demoResourceInspections,systemTools:data.demoSystemTools,spaces:data.demoKnowledgeSnapshots,spaceSummaries:data.demoKnowledgeSummaries}))
} finally { await server.close() }
const after = await sourceInputs(root)
if (before.digest !== after.digest) throw new Error('Source files changed during build. Rebuild before publishing.')
await mkdir('.odyssey-dev',{recursive:true})
await writeFile('.odyssey-dev/demo-build-input.json',JSON.stringify({sourceDigest:after.digest,sourceFiles:after.files,bundleDigest:sha256(JSON.stringify(await inventory('apps/web/dist-demo'))),referenceBundleDigest:sha256(JSON.stringify(await inventory('apps/web/dist-demo-reference')))},null,2)+'\n')
