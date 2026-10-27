import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipDirectory } from './zip-directory.mjs'
import { sourceInputs } from './demo-inputs.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
async function inventory(directory, prefix = '') {
  const result = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const relative = prefix + entry.name, absolute = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symlinks cannot be published: ${relative}`)
    if (entry.isDirectory()) result.push(...await inventory(absolute, `${relative}/`))
    else result.push({ path: relative, bytes: (await readFile(absolute)).length, sha256: sha(await readFile(absolute)) })
  }
  return result
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
execFileSync(process.execPath,['scripts/sync-demo.mjs','--check'],{stdio:'inherit'})
const verification=JSON.parse(await readFile('.odyssey-dev/demo-data-verification.json','utf8'))
const snapshot=JSON.parse(await readFile('apps/web/src/demo/data/snapshot.json','utf8'))
const commit = git('rev-parse', 'HEAD')
const builtAt = new Date().toISOString()
const releaseId = `odyssey-demo-${builtAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${commit.slice(0,7)}`
const dist = path.join(root, 'apps/web/dist-demo')
const files = await inventory(dist)
const buildRecord = JSON.parse(await readFile('.odyssey-dev/demo-build-input.json','utf8'))
const currentSource = await sourceInputs(root)
if (currentSource.digest !== buildRecord.sourceDigest || sha(JSON.stringify(files)) !== buildRecord.bundleDigest) {
  throw new Error('Source or build output changed. Run pnpm demo:build and pnpm demo:smoke again.')
}
const smoke = JSON.parse(await readFile('.odyssey-dev/demo-smoke/results.json','utf8'))
if (smoke.status !== 'passed' || smoke.bundleDigest !== buildRecord.bundleDigest) throw new Error('This build has no passing browser smoke result')
if (smoke.uiParity?.status !== 'passed' || smoke.uiParity.count < 18 || smoke.referenceBundleDigest !== buildRecord.referenceBundleDigest) {
  throw new Error('The shared-page UI parity gate has not passed for this build')
}
if (!files.some(file => file.path === 'index.html')) throw new Error('Build the demo first')
if (files.length > 950) throw new Error('Too many files for dashboard upload; use Wrangler')
for (const file of files) {
  if (file.bytes > 25 * 1024 * 1024) throw new Error(`Asset too large: ${file.path}`)
  if (/\.(map|py|sql|ody|env)$/i.test(file.path) || /(^|\/)\.env/.test(file.path)) throw new Error(`Unexpected public asset: ${file.path}`)
}
const scripts = (await Promise.all(files.filter(file => file.path.endsWith('.js')).map(file => readFile(path.join(dist, file.path), 'utf8')))).join('\n')
if (!scripts.includes('PUBLIC DEMO') || scripts.includes('DevelopmentSaveFault') || /https?:\/\/(localhost|127\.0\.0\.1)([:/"'])/.test(scripts)) {
  throw new Error('Demo marker missing, development transport included, or loopback URL found in bundle')
}
const output = path.join(root, 'artifacts/demo', releaseId)
const site = path.join(output, 'site')
await mkdir(output, { recursive: true })
await cp(dist, site, { recursive: true, errorOnExist: true, force: false })
const sources = currentSource.files, sourceDigest = currentSource.digest
const release = { releaseId, builtAt, mode: 'demo', commit, sourceDigest, dirtyWorkingTree: Boolean(git('status', '--porcelain')), cases: snapshot.journeys.length, documents: snapshot.knowledgeSpaces.reduce((n,space)=>n+space.resources.length,0), dataDigest: verification.dataDigest, snapshotSha256:verification.snapshotSha256, dataCapturedAt:snapshot.capturedAt, localCases:verification.journeys, uiContract: 'shared-pages-v1', uiParityComparisons: smoke.uiParity.count }
await writeFile(path.join(site, 'release.json'), JSON.stringify(release,null,2)+'\n')
await writeFile(path.join(site, '_headers'), '/index.html\n  Cache-Control: no-cache\n/release.json\n  Cache-Control: no-cache\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n')
// Pages' SPA fallback requires no top-level 404.html.
const published = await inventory(site)
await writeFile(path.join(output, 'release-manifest.json'), JSON.stringify({ ...release, sourceFiles:sources, files:published },null,2)+'\n')
await writeFile(path.join(output, 'SHA256SUMS.txt'), published.map(file => `${file.sha256}  site/${file.path}`).join('\n')+'\n')
await cp('.odyssey-dev/demo-smoke',path.join(output,'browser-evidence'),{recursive:true})
await zipDirectory(site, published, path.join(output,'upload.zip'))
await writeFile(path.join(output, 'upload.zip.sha256'), sha(await readFile(path.join(output,'upload.zip')))+'  upload.zip\n')
await writeFile(path.join(output,'UPLOAD-README.txt'), `Release: ${releaseId}\nUpload ONLY the site folder or upload.zip to Cloudflare Pages.\nDo not upload this parent folder, source code or .env files.\nBuilt from ${release.dirtyWorkingTree ? 'a working tree with uncommitted changes' : 'a clean commit'}.\nSource digest: ${sourceDigest}\nSee doc/deployment/public-demo-release-guide.md for updates and rollback.\n`)
console.log(`Demo release prepared: ${output}\nUpload: ${site}\nCommit: ${commit}\nWorking tree dirty: ${release.dirtyWorkingTree}`)
